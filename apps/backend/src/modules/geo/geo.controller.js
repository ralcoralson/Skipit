/**
 * HTTPS IP Geolocation Controller (Phase 3.5)
 * Securely resolves client IP to city/coordinates over HTTPS.
 * Prevents cleartext HTTP traffic violations on modern mobile OS (Android 15 / iOS).
 */

const getGeoFromIp = async (req, res, next) => {
  try {
    // 1. Extract real client IP
    const forwarded = req.headers['x-forwarded-for'];
    let clientIp = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

    // Normalize IPv6 mapped IPv4 address
    if (clientIp && clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.replace('::ffff:', '');
    }

    const isLocal = !clientIp || clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.');

    if (isLocal) {
      // Default to Bengaluru, Karnataka for local development/testing
      return res.json({
        success: true,
        ip: clientIp || '127.0.0.1',
        city: 'Bengaluru',
        region: 'Karnataka',
        country: 'India',
        country_code: 'IN',
        lat: 12.9716,
        lon: 77.5946,
        is_local: true,
      });
    }

    // 2. Query secure HTTPS geolocation service
    try {
      const response = await fetch(`https://ipapi.co/${clientIp}/json/`, {
        headers: { 'User-Agent': 'SkipIt-Server/3.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        const geoData = await response.json();
        return res.json({
          success: true,
          ip: clientIp,
          city: geoData.city || 'Bengaluru',
          region: geoData.region || 'Karnataka',
          country: geoData.country_name || 'India',
          country_code: geoData.country_code || 'IN',
          lat: geoData.latitude || 12.9716,
          lon: geoData.longitude || 77.5946,
        });
      }
    } catch (fetchErr) {
      console.warn('[Geo IP Service Warning]:', fetchErr.message);
    }

    // Fallback default
    res.json({
      success: true,
      ip: clientIp,
      city: 'Bengaluru',
      region: 'Karnataka',
      country: 'India',
      country_code: 'IN',
      lat: 12.9716,
      lon: 77.5946,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGeoFromIp,
};
