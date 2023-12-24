import { Socket } from "net";
import { IPlayer, IMediaServerOptions } from "@types";
import * as http from "http";

const URL = require("url");
const Logger = require("../node_core_logger");
const NodeCoreUtils = require("../node_core_utils");

class FlvPacketHeader {
  constructor(
    public length: number = 0,
    public timestamp: number = 0,
    public type: number = 0
  ) {}
}

class FlvPacket {
  public header: FlvPacketHeader;

  constructor(public payload: any = null, type: number = 0, time: number = 0) {
    this.header = new FlvPacketHeader(
      this.payload ? this.payload.length : 0,
      time,
      type
    );
  }
}

export class FlvSession implements IPlayer {
  private _id: string;
  private _ip?: string;

  private _playStreamPath: string = "";
  private _playArgs: any;

  private _starting: boolean = false;
  private _paused: boolean = false;
  private _playing: boolean = false;
  private _idling: boolean = false;
  private _recievedAudio: boolean = false;

  private _tag?: string;

  private _numPlayCache: number = 0;
  private _connectTime?: Date;

  private _connectCmdObj?: any;

  constructor(
    private _config: IMediaServerOptions,
    public req: http.ClientRequest,
    public res: http.ServerResponse
  ) {
    this._id = NodeCoreUtils.generateNewSessionID();
    this._ip = this.req.socket?.remoteAddress;

    this.res.cork = this.res.socket?.cork.bind(this.res.socket)!;
    this.res.uncork = this.res.socket?.uncork.bind(this.res.socket)!;
    this.req.socket?.on("close", this.onReqClose.bind(this));
    this.res.on("error", this.onReqError.bind(this));

    //@ts-ignore;
    if (this.req.nmsConnectionType === "ws") {
      //@ts-ignore;
      this.res.write = this.res.socket?.send;
      //@ts-ignore;
      this.res.end = this.res.socket?.close;
      this._tag = "websocket-flv";
    } else {
      this._tag = "http-flv";
    }

    players_sessions.set(this._id, this);
  }
  get numPlayCache(): number {
    return this._numPlayCache;
  }
  set numPlayCache(val: number) {
    this._numPlayCache = val;
  }
  get starting(): boolean {
    return this._starting;
  }
  get playing(): boolean {
    return this._playing;
  }
  get paused(): boolean {
    return this._paused;
  }
  get receivedAudio(): boolean {
    return this._recievedAudio;
  }
  get streamId(): number {
    throw new Error("Method not implemented.");
  }
  get streamPath(): string {
    return this._playStreamPath;
  }
  get socket(): Socket {
    return this.res.socket!;
  }

  public async play(): Promise<void> {
    console.log("Play!");
  }

  public async run(): Promise<void> {
    const method = this.req.method;
    //@ts-ignore;
    const urlInfo = URL.parse(this.req.url, true);
    const streamPath = urlInfo.pathname.split(".")[0];
    this._connectCmdObj = {
      ip: this._ip,
      method,
      streamPath,
      query: urlInfo.query,
    };
    this._connectTime = new Date();
    this._starting = true;
    Logger.log(
      `[${this._tag} connect] id=${this._id} ip=${
        this._ip
      } args=${JSON.stringify(urlInfo.query)}`
    );
    events.emit("preConnect", this._id, this._connectCmdObj);
    if (!this._starting) {
      this.stop();
      return;
    }
    events.emit("postConnect", this._id, this._connectCmdObj);

    if (method === "GET") {
      this._playStreamPath = streamPath;
      this._playArgs = urlInfo.query;

      this.onPlay();
    } else {
      this.stop();
    }
  }

  public async stop(): Promise<void> {
    if (this._starting) {
      this._starting = false;
      const publisherId = publishers_paths.get(this._playStreamPath);
      if (publisherId != null) {
        publisher_sessions.get(publisherId)?.players.delete(this._id);
        events.emit("donePlay", this._id, this._playStreamPath, this._playArgs);
      }
      Logger.log(
        `[${this._tag} play] Close stream. id=${this._id} streamPath=${this._playStreamPath}`
      );
      Logger.log(`[${this._tag} disconnect] id=${this._id}`);
      this._connectCmdObj.bytesWritten = this.res.socket?.bytesWritten;
      this._connectCmdObj.bytesRead = this.res.socket?.bytesRead;
      events.emit("doneConnect", this._id, this._connectCmdObj);
      this.res.end();
      idlePlayers.delete(this._id);
      sessions.delete(this._id);
    }
  }

  private onReqClose(): void {
    Logger.error(`FLV session closed`);
    this.stop();
  }

  private onReqError(e: Error): void {
    Logger.error(`FLV session request error ${e}`);
    this.stop();
  }

  private reject(): void {
    Logger.log(`[${this._tag} reject] id=${this._id}`);
    this.stop();
  }

  private onPlay(): void {
    events.emit("prePlay", this._id, this._playStreamPath, this._playArgs);
    if (!this._starting) {
      return;
    }
    if (this._config.auth !== undefined && this._config.auth.play) {
      let results = NodeCoreUtils.verifyAuth(
        this._playArgs.sign,
        this._playStreamPath,
        this._config.auth.secret
      );
      if (!results) {
        Logger.log(
          `[${this._tag} play] Unauthorized. id=${this._id} streamPath=${this._playStreamPath} sign=${this._playArgs.sign}`
        );
        this.res.statusCode = 403;
        this.res.end();
        return;
      }
    }

    if (!publishers_paths.has(this._playStreamPath)) {
      Logger.log(
        `[${this._tag} play] Stream not found. id=${this._id} streamPath=${this._playStreamPath} `
      );
      idlePlayers.add(this._id);
      this._idling = true;
      return;
    }

    this.onStartPlay();
  }

  private onStartPlay(): void {
    const publisherId = publishers_paths.get(this._playStreamPath);
    if (publisherId == undefined) {
      Logger.error(
        `[${this._tag} onStartPlay] publisher not found - ${publisherId}`
      );
      return;
    }

    const publisher = publisher_sessions.get(publisherId);
    if (publisher == undefined) {
      Logger.error(
        `[${this._tag} onStartPlay] publisher session not found - ${publisherId}`
      );
      return;
    }

    publisher.players.add(this._id);
    //send FLV header
    const FLVHeader = Buffer.from([
      0x46, 0x4c, 0x56, 0x01, 0x00, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00,
      0x00,
    ]);
    if (publisher.firstAudioReceived) {
      FLVHeader[4] |= 0b00000100;
    }

    if (publisher.firstVideoReceived) {
      FLVHeader[4] |= 0b00000001;
    }

    this.res.write(FLVHeader);

    if (publisher.metaData != null) {
      let packet = new FlvPacket(publisher.metaData, 18);
      let tag = FlvSession.createFlvTag(packet);
      this.res.write(tag);
    }

    if (publisher.audioCodec == 10) {
      let packet = new FlvPacket(publisher.aacSequenceHeader, 8);
      let tag = FlvSession.createFlvTag(packet);
      this.res.write(tag);
    }

    if (publisher.videoCodec == 7 || publisher.videoCodec == 12) {
      let packet = new FlvPacket(publisher.avcSequenceHeader, 9);
      let tag = FlvSession.createFlvTag(packet);
      this.res.write(tag);
    }

    if (publisher.flvGopCacheQueue != null) {
      for (let tag of publisher.flvGopCacheQueue) {
        this.res.write(tag);
      }
    }

    this._idling = false;
    this._playing = true;
    Logger.log(
      `[${this._tag} play] Join stream. id=${this._id} streamPath=${this._playStreamPath} `
    );
    events.emit("postPlay", this._id, this._playStreamPath, this._playArgs);
  }

  public static createFlvTag(packet: FlvPacket): Buffer {
    let PreviousTagSize = 11 + packet.header.length;
    let tagBuffer = Buffer.alloc(PreviousTagSize + 4);
    tagBuffer[0] = packet.header.type;
    tagBuffer.writeUIntBE(packet.header.length, 1, 3);
    tagBuffer[4] = (packet.header.timestamp >> 16) & 0xff;
    tagBuffer[5] = (packet.header.timestamp >> 8) & 0xff;
    tagBuffer[6] = packet.header.timestamp & 0xff;
    tagBuffer[7] = (packet.header.timestamp >> 24) & 0xff;
    tagBuffer.writeUIntBE(0, 8, 3);
    tagBuffer.writeUInt32BE(PreviousTagSize, PreviousTagSize);
    packet.payload.copy(tagBuffer, 11, 0, packet.header.length);
    return tagBuffer;
  }
}
