import { S3Bucket } from "@storage";

export interface ITransmuxTaskConfig {
    ffmpeg_path: string;
    vc?: string;
    ac?: string;
    vcParam?: string[];
    acParam?: string[];
    mediaroot_path: string;
    rtmpPort: number;
    app: string;
    streamPath: string;
    streamApp: string;
    streamName: string;
    mp4?: boolean;
    mp4Flags?: string;
    hls?: boolean;
    hlsFlags?: string;
    dash?: boolean;
    dashFlags?: string;
    storage?: S3Bucket;
    args?: { [key: string]: any };
  }