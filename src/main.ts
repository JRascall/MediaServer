require("dotenv").config();

const { FFMPEG_PATH, S3_END_POINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
  process.env;

import { IMediaServerOptions, IPlayer, IPublisher } from "@types";
import minimist from "minimist";
import { MediaServer } from "./MediaServer";
import { EventEmitter } from "stream";
import express from "express";
import path from "path";

global.sessions = new Map<string, IPublisher | IPlayer>();
global.publishers_paths = new Map<string, string>();
global.idlePlayers = new Set<string>();
global.stat = {
  inbytes: 0,
  outbytes: 0,
  accepted: 0,
};
global.events = new EventEmitter();
global.publisher_sessions = new Map<string, IPublisher>();
global.players_sessions = new Map<string, IPlayer>();

const argv = minimist(process.argv.slice(2), {
  string: ["rtmp_port", "http_port", "https_port"],
  alias: {
    rtmp_port: "r",
    http_port: "h",
    https_port: "s",
  },
  default: {
    rtmp_port: 1935,
    http_port: 8000,
    https_port: 8443,
  },
});

if (argv.help) {
  console.log("Usage:");
  console.log("  node-media-server --help // print help information");
  console.log("  node-media-server --rtmp_port 1935 or -r 1935");
  console.log("  node-media-server --http_port 8000 or -h 8000");
  console.log("  node-media-server --https_port 8443 or -s 8443");
  process.exit(0);
}

const config: IMediaServerOptions = {
  rtmp: {
    port: argv.rtmp_port,
    chunk_size: 60000,
    gop_cache: true,
    ping: 60,
    ping_timeout: 30,
  },
  http: {
    port: 8000,
    allow_origin: "*",
    mediaroot_path: path.join(__dirname, 'public', 'media'),
  },
  auth: {
    play: false,
    publish: false,
  },
  transmuxing: {
    tasks: [
      {
        app: "live",
        hls: true,
        hlsFlags: "-hls_time=4 -hls_list_size=3",
        hlsKeep: true,
        dash: false,
        dashFlags: "[f=dash:window_size=3:extra_window_size=5]",
        dashKeep: true,
      },
    ],
  },
  storage: {
    endpoint: S3_END_POINT ?? "",
    access_key_id: S3_ACCESS_KEY_ID ?? "",
    secret_access_key: S3_SECRET_ACCESS_KEY ?? "",
  },
  ffmpeg_path: FFMPEG_PATH ?? "/usr/bin/ffmpeg",
};

let server: MediaServer;

process.once("SIGUSR2", () => {
  if(server)server.stop();
  process.kill(process.pid, "SIGUSR2");
});

process.on("SIGINT", () => {
  if(server)server.stop();
  process.exit(0);
});

(async () => {
  server = new MediaServer(config);
  await server.run();
})();
const exp = express();
exp.use(express.static("public"));

//const web_app = exp.listen(3000, () => {});
