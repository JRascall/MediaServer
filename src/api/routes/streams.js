const express = require('express');
const streamController = require('../controllers/streams');

module.exports = () => {
  let router = express.Router();
  router.post('/trans', streamController.postStreamTrans.bind());
  router.get('/', streamController.getStreams.bind());
  router.get('/:app/:stream', streamController.getStream.bind());
  router.delete('/:app/:stream', streamController.delStream.bind());
  return router;
};
