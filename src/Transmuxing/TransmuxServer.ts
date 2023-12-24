import mkdirp from "mkdirp";
import { IMediaServerOptions, IRunnable, ITransmuxTaskConfig } from "@types";
import fs, { constants as FSConstants } from "fs";
import { FFMPEGTask } from "@transmuxing";
import { S3Bucket } from "@storage";

const Logger = require("../node_core_logger");
const { getFFmpegVersion, getFFmpegUrl } = require("../node_core_utils");

export class TransmuxServer implements IRunnable {
  private _running_tasks: Map<string, FFMPEGTask> = new Map();

  constructor(private _config: IMediaServerOptions) {}

  public async run(): Promise<void> {
    const mediaRootPath = this._config.http.mediaroot_path!;
    const ffmpegPath = this._config.ffmpeg_path!;

    try {
      await mkdirp(mediaRootPath);
      await fs.promises.access(mediaRootPath, FSConstants.W_OK);
    } catch (error) {
      this.printError(`MediaRoot:${mediaRootPath} cannot be written.`);
      return;
    }

    try {
      await fs.promises.access(ffmpegPath, FSConstants.X_OK);
    } catch (error) {
      this.printError(`ffmpeg:${ffmpegPath} cannot be executed.`);
      return;
    }

    try {
      const version = await getFFmpegVersion(ffmpegPath);
      if (version === "" || parseInt(version.split(".")[0]) < 4) {
        this.printError("ffmpeg requires version 4.0.0 or above");
        Logger.error(
          "Download the latest ffmpeg static program:",
          getFFmpegUrl()
        );
        return;
      }

      const apps = this._config.transmuxing.tasks
        .map((task: any) => task.app)
        .join(" ");
      events.on("postPublish", this.onPostPublish.bind(this));
      events.on("donePublish", this.onDonePublish.bind(this));
      Logger.log(
        `[Transmuxing server] started for apps: [${apps}], MediaRoot: ${mediaRootPath}, ffmpeg version: ${version}`
      );
    } catch (error) {
      this.printError(
        "Error in getting ffmpeg version or initializing events."
      );
    }
  }

  private printError(message: string): void {
    Logger.error(`[Transmuxing server] ${message}`);
  }

  private onPostPublish(id: string, streamPath: string, ...args: any[]): void {
    const regexResult = /\/(.*)\/(.*)/gi.exec(streamPath);
    if (!regexResult) {
      Logger.error(`Invalid stream path: ${streamPath}`);
      return;
    }

    const [app, name] = regexResult.slice(1);
    for (const task of this._config.transmuxing.tasks) {
      if (app === task.app) {
        let taskConfig: ITransmuxTaskConfig = {
          ...task,
          ffmpeg_path: this._config.ffmpeg_path,
          mediaroot_path: this._config.http.mediaroot_path,
          rtmpPort: this._config.rtmp?.port,
          streamPath,
          streamApp: app,
          streamName: name,
          args,
        };

        if (this._config.storage) {
          taskConfig.storage = new S3Bucket(
            "streams",
            this._config.storage!.access_key_id,
            this._config.storage!.secret_access_key,
            this._config.storage!.endpoint
          );
        }

        const running_task = new FFMPEGTask(taskConfig);
        this._running_tasks.set(id, running_task);
        running_task.on("end", () => this._running_tasks.delete(id));
        running_task.run();
      }
    }
  }

  private onDonePublish(id: string, streamPath: string, ...args: any[]): void {
    this._running_tasks.get(id)?.stop();
  }

  public async stop(): Promise<void> {
    for(const [k, v] of this._running_tasks)
    {
      v.stop();
    }
  }
}
