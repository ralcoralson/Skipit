const express = require('express');
const router = express.Router();
const geoController = require('./geo.controller');

router.get('/ip', geoController.getGeoFromIp);

module.exports = router;
