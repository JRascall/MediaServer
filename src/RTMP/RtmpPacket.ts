export class RtmpPacketHeader {
  public timestamp: number = 0;
  public length: number = 0;
  public type: number = 0;
  public stream_id: number = 0;

  constructor(public fmt: number = 0, public cid: number = 0) {}
}

export class RtmpPacket {
  public header: RtmpPacketHeader;
  public clock: number = 0;
  public payload: any;
  public capacity: number = 0;
  public bytes: number = 0;

  constructor(fmt: number = 0, cid: number = 0) {
    this.header = new RtmpPacketHeader(fmt, cid);
  }
}
