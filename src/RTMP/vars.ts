export const FLASHVER = 'LNX 9,0,124,2';
export const RTMP_OUT_CHUNK_SIZE = 60000;
export const RTMP_PORT = 1935;

export const RTMP_HANDSHAKE_SIZE = 1536;
export const RTMP_HANDSHAKE_UNINIT = 0;
export const RTMP_HANDSHAKE_0 = 1;
export const RTMP_HANDSHAKE_1 = 2;
export const RTMP_HANDSHAKE_2 = 3;

export const RTMP_PARSE_INIT = 0;
export const RTMP_PARSE_BASIC_HEADER = 1;
export const RTMP_PARSE_MESSAGE_HEADER = 2;
export const RTMP_PARSE_EXTENDED_TIMESTAMP = 3;
export const RTMP_PARSE_PAYLOAD = 4;

export const RTMP_CHUNK_HEADER_MAX = 18;

export const RTMP_CHUNK_TYPE_0 = 0; // 11-bytes: timestamp(3) + length(3) + stream type(1) + stream id(4)
export const RTMP_CHUNK_TYPE_1 = 1; // 7-bytes: delta(3) + length(3) + stream type(1)
export const RTMP_CHUNK_TYPE_2 = 2; // 3-bytes: delta(3)
export const RTMP_CHUNK_TYPE_3 = 3; // 0-byte

export const RTMP_CHANNEL_PROTOCOL = 2;
export const RTMP_CHANNEL_INVOKE = 3;
export const RTMP_CHANNEL_AUDIO = 4;
export const RTMP_CHANNEL_VIDEO = 5;
export const RTMP_CHANNEL_DATA = 6;

export const rtmpHeaderSize = [11, 7, 3, 0];

/* Protocol Control Messages */
export const RTMP_TYPE_SET_CHUNK_SIZE = 1;
export const RTMP_TYPE_ABORT = 2;
export const RTMP_TYPE_ACKNOWLEDGEMENT = 3; // bytes read report
export const RTMP_TYPE_WINDOW_ACKNOWLEDGEMENT_SIZE = 5; // server bandwidth
export const RTMP_TYPE_SET_PEER_BANDWIDTH = 6; // client bandwidth

/* User Control Messages Event (4) */
export const RTMP_TYPE_EVENT = 4;

export const RTMP_TYPE_AUDIO = 8;
export const RTMP_TYPE_VIDEO = 9;

/* Data Message */
export const RTMP_TYPE_FLEX_STREAM = 15; // AMF3
export const RTMP_TYPE_DATA = 18; // AMF0

/* Shared Object Message */
export const RTMP_TYPE_FLEX_OBJECT = 16; // AMF3
export const RTMP_TYPE_SHARED_OBJECT = 19; // AMF0

/* Command Message */
export const RTMP_TYPE_FLEX_MESSAGE = 17; // AMF3
export const RTMP_TYPE_INVOKE = 20; // AMF0

/* Aggregate Message */
export const RTMP_TYPE_METADATA = 22;

export const RTMP_CHUNK_SIZE = 128;
export const RTMP_PING_TIME = 60000;
export const RTMP_PING_TIMEOUT = 30000;

export const STREAM_BEGIN = 0x00;
export const STREAM_EOF = 0x01;
export const STREAM_DRY = 0x02;
export const STREAM_EMPTY = 0x1f;
export const STREAM_READY = 0x20;

export const RTMP_TRANSACTION_CONNECT = 1;
export const RTMP_TRANSACTION_CREATE_STREAM = 2;
export const RTMP_TRANSACTION_GET_STREAM_LENGTH = 3;

export const RTMP_ACK_PACKET_HEX  = "02000000000004030000000000000000";
export const RTMP_WINDOW_ACK_PACKET_HEX = "02000000000004050000000000000000";
export const RTMP_PEER_BANDWIDTH_PACKET_HEX = "0200000000000506000000000000000000";
export const RTMP_CHUNK_SIZE_PACKET_HEX = "0200000000000506000000000000000000";
export const RTMP_STREAM_STATUS_PACKET_HEX = "020000000000060400000000000000000000";