import { IMediaServerOptions, IRunnable, IPlayer } from "@types";
import express from "express";
import { FlvSession } from "@flv";
import * as http from "http";
import * as https from "https";
import * as websocket from "ws";
import * as fs from "fs";

const path = require("path");
const bodyParser = require("body-parser");
const basicAuth = require("basic-auth-connect");
const HTTP_PORT = 80;
const HTTPS_PORT = 443;
const HTTP_MEDIAROOT = "./public/media";
const Logger = require("../node_core_logger");

export class HttpServer implements IRunnable {
  private _port: number;
  private _securePort: number = 0;
  private _mediaRootPath: string;
  private _httpServer: http.Server;
  private _httpsServer?: https.Server;
  private _webSocketServer?: websocket.Server;
  private _secureWebSocketServer?: websocket.Server;

  constructor(private _config: IMediaServerOptions) {
    this._port = this._config.http.port || HTTP_PORT;
    this._mediaRootPath = this._config.http.mediaroot_path || HTTP_MEDIAROOT;

    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.all("*", (req, res, next) => {
      res.header("Access-Control-Allow-Origin", this._config.http.allow_origin);
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type,Content-Length, Authorization, Accept,X-Requested-With"
      );
      res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Credentials", "true");
      req.method === "OPTIONS" ? res.sendStatus(200) : next();
    });

    app.get("*.flv", (req, res, next) => {
      //@ts-ignore;
      req.nmsConnectionType = "http";
      this.onConnect(req, res);
    });

    let adminEntry = path.join(__dirname + "/public/admin/index.html");
    if (fs.existsSync(adminEntry)) {
      app.get("/admin/*", (req, res) => {
        res.sendFile(adminEntry);
      });
    }

    if (this._config.http.api !== false) {
      if (this._config.auth && this._config.auth.api) {
        app.use(
          ["/api/*", "/static/*", "/admin/*"],
          basicAuth(this._config.auth.api_user, this._config.auth.api_pass)
        );
      }
      /*app.use("/api/streams", streamsRoute());
      app.use("/api/server", serverRoute());
      app.use("/api/relay", relayRoute());*/
    }

    app.get("/testing", (req, res) => {
      console.log("Testing?");
      res.sendStatus(200);
    });

    app.use(express.static(path.join(__dirname + "/public")));
    app.use(express.static(this._mediaRootPath));
    if (this._config.http.webroot_path) {
      app.use(express.static(this._config.http.webroot_path));
    }

    this._httpServer = http.createServer(app);

    /**
     * ~ openssl genrsa -out privatekey.pem 1024
     * ~ openssl req -new -key privatekey.pem -out certrequest.csr
     * ~ openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem
     */
    if (this._config.https) {
      let options = {
        key: fs.readFileSync(this._config.https.key_patth),
        cert: fs.readFileSync(this._config.https.cert_path),
      };
      if (this._config.https.passphrase) {
        Object.assign(options, { passphrase: this._config.https.passphrase });
      }
      this._securePort = this._config.https.port || HTTPS_PORT;
      this._httpsServer = https.createServer(options, app);
    }
  }

  public async run(): Promise<void> {
    this._httpServer.listen(this._port, () => {
      Logger.log(`Node Media Http Server started on port: ${this._port}`);
    });

    this._httpServer.on("error", (e) => {
      Logger.error(`Node Media Http Server ${e}`);
    });

    this._httpServer.on("close", () => {
      Logger.log("Node Media Http Server Close.");
    });

    this._webSocketServer = new websocket.Server({ server: this._httpServer });

    this._webSocketServer.on("connection", (ws: any, req: any) => {
      //@ts-ignore;
      req.nmsConnectionType = "ws";
      this.onConnect(req, ws);
    });

    this._webSocketServer.on("listening", () => {
      Logger.log(`Node Media WebSocket Server started on port: ${this._port}`);
    });
    this._webSocketServer.on("error", (e) => {
      Logger.error(`Node Media WebSocket Server ${e}`);
    });

    if (this._httpsServer) {
      this._httpsServer.listen(this._securePort, () => {
        Logger.log(
          `Node Media Https Server started on port: ${this._securePort}`
        );
      });

      this._httpsServer.on("error", (e) => {
        Logger.error(`Node Media Https Server ${e}`);
      });

      this._httpsServer.on("close", () => {
        Logger.log("Node Media Https Server Close.");
      });

      this._secureWebSocketServer = new websocket.Server({
        server: this._httpsServer,
      });

      this._secureWebSocketServer.on(
        "connection",
        (ws: websocket.WebSocket, req: express.Request) => {
          //@ts-ignore;
          req.nmsConnectionType = "ws";
          this.onConnect(req, ws);
        }
      );

      this._secureWebSocketServer.on("listening", () => {
        Logger.log(
          `Node Media WebSocketSecure Server started on port: ${this._securePort}`
        );
      });
      this._secureWebSocketServer.on("error", (e) => {
        Logger.error(`Node Media WebSocketSecure Server ${e}`);
      });
    }

    events.on("postPlay", (id: string, ...args: any[]) => {
      stat.accepted++;
    });

    events.on("postPublish", (id: string, ...args: any[]) => {
      stat.accepted++;
    });

    events.on("doneConnect", (id: string, ...args: any[]) => {
      const player_session = players_sessions.get(id);
      if (player_session == undefined) return;
      const socket =
        player_session instanceof FlvSession
          ? player_session.req.socket
          : player_session.socket;
      stat.inbytes += socket!.bytesRead;
      stat.outbytes += socket!.bytesWritten;
    });
  }

  public async stop(): Promise<void> {
    this._httpServer.close();
    if (this._httpsServer) {
      this._httpsServer.close();
    }
    players_sessions.forEach((session: IPlayer, id: string) => {
      session.req.destroy();
      sessions.delete(id);
      players_sessions.delete(id);
      publisher_sessions.delete(id);
    });
  }

  private onConnect(req: any, res: any) {
    let session = new FlvSession(this._config, req, res);
    session.run();
  }
}
