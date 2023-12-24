const express = require('express');
const serverController = require('../controllers/server');

module.exports = () => {
  let router = express.Router();
  router.get('/', serverController.getInfo.bind());
  return router;
};
