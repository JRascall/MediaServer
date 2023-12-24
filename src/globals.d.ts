import { EventEmitter } from "events";
import { IPublisher, IPlayer } from "@types";

declare global {
    var sessions: Map<string, IPublisher | IPlayer>;
    var publishers_paths: Map<string, string>;
    var idlePlayers: Set<string>;
    var events; EventEmitter;
    var stat: {
        inbytes: number,
        outbytes: number,
        accepted: 
        number
    };

    var publisher_sessions: Map<string, IPublisher>;
    var players_sessions: Map<string, IPlayer>;
}

export {};