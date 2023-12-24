import { IRunnable } from "@types";

export interface IPublisher extends IRunnable {
    get players(): Set<string>;
    get firstAudioReceived(): boolean;
    get firstVideoReceived(): boolean;
    get metaData(): any;
    get aacSequenceHeader(): any;
    get avcSequenceHeader(): any;
    get audioCodec(): number;
    get videoCodec(): number;
    get streamPath(): string;
    get parserPacket(): any;
    get flvGopCacheQueue(): any;
    get rtmpGopCacheQueue(): any;
}