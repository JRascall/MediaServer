import { TransmuxServer } from "@transmuxing";
import { IMediaServerOptions, IRunnable } from "@types";
import { HttpServer } from "@http";
import NodeFissionServer from "./node_fission_server";
import NodeRelayServer from "./node_relay_server";
import { RtmpServer } from "@rtmp";
import { S3Bucket } from "@storage";

const Logger = require("./node_core_logger");
const Package = require("../package.json");

export class MediaServer implements IRunnable {
  private _rtmpServer?: IRunnable;
  private _httpServer?: IRunnable;
  private _transmuxServer?: IRunnable;
  private _relayServer?: NodeRelayServer;
  private _fissionServer?: NodeFissionServer;

  constructor(private _config: IMediaServerOptions) {}

  public async run(): Promise<void> {
    Logger.setLogType(this._config.logType);
    Logger.log(`Media Server v${Package.version}`);

    if (this._config.rtmp) {
      this._rtmpServer = new RtmpServer(this._config);
      this._rtmpServer?.run();
    }

    if (this._config.http) {
      this._httpServer = new HttpServer(this._config);
      this._httpServer?.run();
    }

    if (this._config.transmuxing) {
      if (this._config.cluster) {
        Logger.log("Transcode server does not work in cluster mode");
      } else {
        this._transmuxServer = new TransmuxServer(this._config);
        this._transmuxServer?.run();
      }
    }

    if (this._config.relay) {
      if (this._config.cluster) {
        Logger.log("Relay server does not work in cluster mode");
      } else {
        this._relayServer = new NodeRelayServer(this._config);
        this._relayServer?.run();
      }
    }

    if (this._config.fission) {
      if (this._config.cluster) {
        Logger.log("Fission server does not work in cluster mode");
      } else {
        this._fissionServer = new NodeFissionServer(this._config);
        this._fissionServer?.run();
      }
    }

    if (this._config.storage) {
      const streamsBucket = new S3Bucket(
        "streams",
        this._config.storage.access_key_id,
        this._config.storage.secret_access_key,
        this._config.storage.endpoint
      );

      streamsBucket.empty();
      streamsBucket.abortUploads();

    }

    process.on("uncaughtException", function (err) {
      Logger.error("uncaughtException", err);
    });

    process.on("SIGINT", function () {
      process.exit();
    });
  }

  public on(eventName: string, listener: (...args: any[]) => void): void {
    events.on(eventName, listener);
  }

  public async stop(): Promise<void> {
    this._relayServer?.stop();
    this._httpServer?.stop();
    this._transmuxServer?.stop();
    this._relayServer?.stop();
    this._fissionServer?.stop();
  }

  public getSession(id: string) {
    return sessions.get(id);
  }
}
