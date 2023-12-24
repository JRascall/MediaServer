import { IRunnable, ITransmuxTaskConfig } from "@types";
import { EventEmitter } from "events";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import chokidar, { FSWatcher as FolderWatcher } from "chokidar";
import fs from "fs";
import path from "path";

const Logger = require("../node_core_logger");
const dateFormat = require("dateformat");
const mkdirp = require("mkdirp");

export class FFMPEGTask extends EventEmitter implements IRunnable {
  private _outPath: string;
  private _inputPath: string;
  private _rtmpOutPath: string;
  private _ffmpegHandle?: ChildProcessWithoutNullStreams;
  private _segmentWatcher?: FolderWatcher;
  private _segments: Set<string> = new Set<string>();
  private _playlistBuffer: Map<string, Buffer> = new Map<string, Buffer>();
  private _segIndex: number = 0;
  private _uploading: boolean = false;

  constructor(private _config: ITransmuxTaskConfig) {
    super();
    this._config = _config;
    this._inputPath = `rtmp://127.0.0.1:${this._config.rtmpPort}${this._config.streamPath}`;
    this._outPath = path.join(
      this._config.mediaroot_path,
      this._config.streamApp,
      this._config.streamName
    );
    //@ts-ignore;
    this._rtmpOutPath = `rtmp://127.0.0.1:${this._config.rtmpPort}/${this._config.rtmpApp}/${this._config.streamName}`;
  }

  private getConfig(key: string) {
    if (!key) return;
    if (typeof this._config != "object") return;
    if (
      this._config.args &&
      typeof this._config.args === "object" &&
      this._config.args[key]
    )
      return this._config.args[key];
    //return this._config[key];
  }

  private isHlsFile(filename: string): boolean {
    return filename.endsWith(".ts") || filename.endsWith(".m3u8");
  }

  private isTemFiles(filename: string): boolean {
    return filename.endsWith(".tmp");
  }

  private isDashFile(filename: string): boolean {
    return filename.endsWith(".mpd") || filename.endsWith(".m4s");
  }

  public async run(): Promise<void> {
    const vc = this._config.vc || "copy";
    const ac = this._config.ac || "copy";
    let outputOptions = [];

    await mkdirp(this._outPath);

    //@ts-ignore;
    if (this._config.rtmp && this._config.rtmpApp) {
      //@ts-ignore;
      if (this._config.rtmpApp === this._config.streamApp) {
        Logger.error("[Transmuxing RTMP] Cannot output to the same app.");
      } else {
        const rtmpPath = this._rtmpOutPath; // Assuming this is already a full path
        outputOptions.push(` -f flv ${rtmpPath}`);
        Logger.log(
          `[Transmuxing RTMP] ${this._config.streamPath} to ${rtmpPath}`
        );
      }
    }

    if (this._config.mp4) {
      const mp4Path = path.join(
        this._outPath,
        `${dateFormat("yyyy-mm-dd-HH-MM-ss")}.mp4`
      );
      outputOptions.push(`${this._config.mp4Flags || ""} -f mp4 "${mp4Path}"`);
      Logger.log(`[Transmuxing MP4] ${this._config.streamPath} to ${mp4Path}`);
    }

    if (this._config.hls) {
      const hlsPath = path.join(this._outPath, "index.m3u8");
      this._config.hlsFlags?.split(" ").forEach((x) => {
        if (x) {
          const [cmd, val] = x.split("=");
          outputOptions.push(cmd, val);
        }
      });
      outputOptions.push("-f", "hls", hlsPath, "-hls_playlist_type", "vod");
      Logger.log(`[Transmuxing HLS] ${this._config.streamPath} to ${hlsPath}`);
    }

    if (this._config.dash) {
      const dashPath = path.join(this._outPath, `index.mpd`);
      outputOptions.push(`${this._config.dashFlags || ""} -f dash ${dashPath}`);
      Logger.log(
        `[Transmuxing DASH] ${this._config.streamPath} to ${dashPath}`
      );
    }

    let argv = [
      "-y",
      "-i",
      this._inputPath,
      "-c:v",
      vc,
      "-c:a",
      ac,
      "-f",
      "tee",
      "-map",
      "0:a?",
      "-map",
      "0:v?",
      ...outputOptions,
    ];

    if (this._config.vcParam) {
      argv.push(...this._config.vcParam);
    }

    if (this._config.acParam) {
      argv.push(...this._config.acParam);
    }

    this.createWatcher();
    this.spawnFFMPEGHandler(argv);
  }

  private async createWatcher(): Promise<void> {
    setInterval(async () => {
      if (this._uploading) return;

      const file_name = `index${this._segIndex}.ts`;
      const path = `${this._outPath}/${file_name}`;

      if (this._segments.has(file_name) && fs.existsSync(path)) {
        Logger.log(path);
        const contents = await fs.promises.readFile(path);
        await this.uploadToCDN(file_name, contents);

        const m3u8Buffer = this._playlistBuffer?.get(file_name);
        if (m3u8Buffer) {
          Logger.log(`m3u8 updated for seg - ${file_name}`);
          await this.uploadToCDN("index.m3u8", m3u8Buffer);
          this._playlistBuffer?.delete(file_name);
        }
        ++this._segIndex;
      }
    }, 100);

    this._segmentWatcher = chokidar.watch(this._outPath, {
      ignored: /(^|[\/\\])\..|\.tmp$|\.part$|\.mpd$|\.mp4$|\.m4s$/,
      persistent: true,
      usePolling: true,
      interval: 100,
    });

    this._segmentWatcher
      .on("change", this.onChange.bind(this))
      .on("add", this.onChange.bind(this));
  }

  private async onChange(filepath: string): Promise<void> {
    const fileContent = await fs.promises.readFile(filepath);
    const fileName = path.basename(filepath);
    const extension = path.extname(filepath);

    if (extension == ".m3u8") {
      const lastSeg = this.getLastSegment(fileContent);
      if (lastSeg) {
        this._playlistBuffer.set(lastSeg, fileContent);
      }
    } else if (extension == ".ts") {
      this._segments.add(fileName);
    }
  }

  private async uploadToCDN(
    file_name: string,
    contents: Buffer
  ): Promise<void> {
    this._uploading = true;
    await this._config.storage?.upload(
      `${this._config.streamApp}/${file_name}`,
      contents
    );
    this._uploading = false;
  }

  private getLastSegment(contents: Buffer) {
    const lines = contents.toString().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].endsWith(".ts")) {
        return lines[i];
      }
    }
    return null;
  }

  private spawnFFMPEGHandler(ffmpeg_args: any[]) {
    this._ffmpegHandle = spawn(this._config.ffmpeg_path, ffmpeg_args);

    this._ffmpegHandle?.on("error", (e: Error) => {
      //Logger.error(e);
      this.stop();
    });

    this._ffmpegHandle?.stdout.on("data", (data: any) => {
      //Logger.log(`FF_LOG:${data}`);
    });

    this._ffmpegHandle?.stderr.on("data", (data: any) => {
      //Logger.log(`FF_LOG:${data}`);
    });

    this._ffmpegHandle?.on("close", (code: any) => {
      this.stop();
    });
  }

  public async stop(): Promise<void> {
    Logger.log("[Transmuxing end] " + this._config.streamPath);
    this.emit("end");

    //@ts-ignore;
    this._ffmpegHandle.kill();
    await this._segmentWatcher?.close();
    await this.cleanTempFiles(this._outPath);
    await this.deleteHlsFiles(this._outPath);
  }

  private async deleteHlsFiles(path: string): Promise<void> {
    if ((!path && !this._config.hls) || this.getConfig("hlsKeep")) return;
    fs.readdir(path, (err: Error | null, files: string[]) => {
      if (err) return;
      files
        .filter((filename) => this.isHlsFile(filename))
        .forEach((filename) => {
          fs.unlinkSync(`${path}/${filename}`);
        });
    });
  }

  private async cleanTempFiles(path: string): Promise<void> {
    if (!path) return;
    fs.readdir(path, (err: Error | null, files: string[]) => {
      if (err) return;
      if (this.getConfig("dashKeep")) {
        files
          .filter((filename) => this.isTemFiles(filename))
          .forEach((filename) => {
            fs.unlinkSync(`${path}/${filename}`);
          });
      } else {
        files
          .filter(
            (filename) => this.isTemFiles(filename) || this.isDashFile(filename)
          )
          .forEach((filename) => {
            fs.unlinkSync(`${path}/${filename}`);
          });
      }
    });
  }
}
