const express = require('express');
const relayController = require('../controllers/relay');

module.exports = () => {
  let router = express.Router();
  router.get('/', relayController.getStreams.bind());
  router.get('/:id', relayController.getStreamByID.bind());
  router.get('/:app/:name', relayController.getStreamByName.bind());
  router.post('/task', relayController.relayStream.bind());
  router.post('/pull', relayController.pullStream.bind());
  router.post('/push', relayController.pushStream.bind());
  router.delete('/:id', relayController.delStream.bind());
  return router;
};
