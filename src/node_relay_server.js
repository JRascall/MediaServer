//
//  Created by Mingliang Chen on 18/3/16.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');

const NodeCoreUtils = require('./node_core_utils');
const NodeRelaySession = require('./node_relay_session');
const { getFFmpegVersion, getFFmpegUrl } = require('./node_core_utils');
const fs = require('fs');
const querystring = require('querystring');
const _ = require('lodash');

class NodeRelayServer {
  constructor(config) {
    this.config = config;
    this.staticCycle = null;
    this.staticSessions = new Map();
    this.dynamicSessions = new Map();
  }

  async run() {
    try {
      fs.accessSync(this.config.relay.ffmpeg, fs.constants.X_OK);
    } catch (error) {
      Logger.error(`Node Media Relay Server startup failed. ffmpeg:${this.config.relay.ffmpeg} cannot be executed.`);
      return;
    }

    let version = await getFFmpegVersion(this.config.relay.ffmpeg);
    if (version === '' || parseInt(version.split('.')[0]) < 4) {
      Logger.error('Node Media Relay Server startup failed. ffmpeg requires version 4.0.0 above');
      Logger.error('Download the latest ffmpeg static program:', getFFmpegUrl());
      return;
    }
    events.on('relayTask', this.onRelayTask.bind(this));
    events.on('relayPull', this.onRelayPull.bind(this));
    events.on('relayPush', this.onRelayPush.bind(this));
    events.on('prePlay', this.onPrePlay.bind(this));
    events.on('donePlay', this.onDonePlay.bind(this));
    events.on('postPublish', this.onPostPublish.bind(this));
    events.on('donePublish', this.onDonePublish.bind(this));
    this.staticCycle = setInterval(this.onStatic.bind(this), 1000);
    Logger.log('Node Media Relay Server started');
  }

  onStatic() {
    if (!this.config.relay.tasks) {
      return;
    }
    let i = this.config.relay.tasks.length;
    while (i--) {
      if (this.staticSessions.has(i)) {
        continue;
      }

      let conf = this.config.relay.tasks[i];
      let isStatic = conf.mode === 'static';
      if (isStatic) {
        conf.name = conf.name ? conf.name : NodeCoreUtils.genRandomName();
        conf.ffmpeg = this.config.relay.ffmpeg;
        conf.inPath = conf.edge;
        conf.ouPath = `rtmp://127.0.0.1:${this.config.rtmp.port}/${conf.app}/${conf.name}`;
        let session = new NodeRelaySession(conf);
        session.id = i;
        session.streamPath = `/${conf.app}/${conf.name}`;
        session.on('end', (id) => {
          sessions.delete(id);
          this.staticSessions.delete(id);
        });
        this.staticSessions.set(i, session);
        session.run();
        Logger.log('[relay static pull] start', i, conf.inPath, 'to', conf.ouPath);
      }
    }
  }

  onRelayTask(path, url) {
    let conf = {};
    conf.ffmpeg = this.config.relay.ffmpeg;
    conf.app = '-';
    conf.name = '-';
    conf.inPath = path;
    conf.ouPath = url;
    let session = new NodeRelaySession(conf);
    const id = session.id;
    sessions.set(id, session);
    session.on('end', (id) => {
      sessions.delete(id);
      this.dynamicSessions.delete(id);
    });
    this.dynamicSessions.set(id, session);
    session.run();
    Logger.log('[relay dynamic task] start id=' + id, conf.inPath, 'to', conf.ouPath);
    events.emit("relayTaskDone", id);
  }

  //从远端拉推到本地
  onRelayPull(url, app, name, rtsp_transport) {
    let conf = {};
    conf.app = app;
    conf.name = name;
    conf.mode = 'pull';
    conf.ffmpeg = this.config.relay.ffmpeg;
    conf.inPath = url;
    if (rtsp_transport){
      conf.rtsp_transport = rtsp_transport
    }
    conf.ouPath = `rtmp://127.0.0.1:${this.config.rtmp.port}/${app}/${name}`;
    let session = new NodeRelaySession(conf);
    const id = session.id;
    sessions.set(id, session);
    session.on('end', (id) => {
      sessions.delete(id);
      this.dynamicSessions.delete(id);
    });
    this.dynamicSessions.set(id, session);
    session.run();
    Logger.log('[relay dynamic pull] start id=' + id, conf.inPath, 'to', conf.ouPath);
    events.emit("relayPullDone", id);
    
  }

  //从本地拉推到远端
  onRelayPush(url, app, name) {
    let conf = {};
    conf.app = app;
    conf.name = name;
    conf.mode = 'push';
    conf.ffmpeg = this.config.relay.ffmpeg;
    conf.inPath = `rtmp://127.0.0.1:${this.config.rtmp.port}/${app}/${name}`;
    conf.ouPath = url;
    let session = new NodeRelaySession(conf);
    const id = session.id;
    sessions.set(id, session);
    session.on('end', (id) => {
      sessions.delete(id);
      this.dynamicSessions.delete(id);
    });
    this.dynamicSessions.set(id, session);
    session.run();
    Logger.log('[relay dynamic push] start id=' + id, conf.inPath, 'to', conf.ouPath);
    events.emit("relayPushDone", id);
  }

  onPrePlay(id, streamPath, args) {
    if (!this.config.relay.tasks) {
      return;
    }
    let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
    let [app, stream] = _.slice(regRes, 1);
    let i = this.config.relay.tasks.length;
    while (i--) {
      let conf = this.config.relay.tasks[i];
      let isPull = conf.mode === 'pull';
      if (isPull && app === conf.app && !publishers.has(streamPath)) {
        let hasApp = conf.edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
        conf.ffmpeg = this.config.relay.ffmpeg;
        conf.inPath = hasApp ? `${conf.edge}/${stream}` : `${conf.edge}${streamPath}`;
        conf.ouPath = `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`;
        if (Object.keys(args).length > 0) {
          conf.inPath += '?';
          conf.inPath += querystring.encode(args);
        }
        let session = new NodeRelaySession(conf);
        session.id = id;
        session.on('end', (id) => {
          this.dynamicSessions.delete(id);
        });
        this.dynamicSessions.set(id, session);
        session.run();
        Logger.log('[relay dynamic pull] start id=' + id, conf.inPath, 'to', conf.ouPath);
      }
    }
  }

  onDonePlay(id, streamPath, args) {
    let session = this.dynamicSessions.get(id);
    let publisher = sessions.get(publishers.get(streamPath));
    if (session && publisher.players.size == 0) {
      session.end();
    }
  }

  onPostPublish(id, streamPath, args) {
    if (!this.config.relay.tasks) {
      return;
    }
    let regRes = /\/(.*)\/(.*)/gi.exec(streamPath);
    let [app, stream] = _.slice(regRes, 1);
    let i = this.config.relay.tasks.length;
    while (i--) {
      let conf = this.config.relay.tasks[i];
      let isPush = conf.mode === 'push';
      if (isPush && app === conf.app) {
        let hasApp = conf.edge.match(/rtmp:\/\/([^\/]+)\/([^\/]+)/);
        conf.ffmpeg = this.config.relay.ffmpeg;
        conf.inPath = `rtmp://127.0.0.1:${this.config.rtmp.port}${streamPath}`;
        conf.ouPath = conf.appendName === false ? conf.edge : (hasApp ? `${conf.edge}/${stream}` : `${conf.edge}${streamPath}`);
        if (Object.keys(args).length > 0) {
          conf.ouPath += '?';
          conf.ouPath += querystring.encode(args);
        }
        let session = new NodeRelaySession(conf);
        session.id = id;
        session.on('end', (id) => {
          this.dynamicSessions.delete(id);
        });
        this.dynamicSessions.set(id, session);
        session.run();
        Logger.log('[relay dynamic push] start id=' + id, conf.inPath, 'to', conf.ouPath);
      }
    }

  }

  onDonePublish(id, streamPath, args) {
    let session = this.dynamicSessions.get(id);
    if (session) {
      session.end();
    }

    for (session of this.staticSessions.values()) {
      if (session.streamPath === streamPath) {
        session.end();
      }
    }
  }

  stop() {
    clearInterval(this.staticCycle);
  }
}

module.exports = NodeRelayServer;
