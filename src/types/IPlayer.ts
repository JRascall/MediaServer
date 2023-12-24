import { Socket } from "net";
import { IRunnable } from "@types";
import * as http from "http";
import { TLSSocket } from "tls";

export interface IPlayer extends IRunnable {
    get starting(): boolean;
    get playing(): boolean;
    get paused(): boolean;
    get receivedAudio(): boolean,
    get streamId(): number;
    get streamPath(): string;
    get socket(): Socket;
    
    get req(): http.ClientRequest | Socket | TLSSocket;
    get res(): http.ServerResponse | Socket | TLSSocket;

    get numPlayCache(): number;
    set numPlayCache(val: number);

    play(): Promise<void>;
    stop(): Promise<void>;
}