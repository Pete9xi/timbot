const axios = require('axios');
const fs = require('fs');
const config = require('./config.json');

/**
 * Twitch Helix API helper ("New Twitch API").
 */
class TwitchApi {
  static get requestOptions() {
    const oauthPrefix = "oauth:";
    let oauthBearer = config.twitch_oauth_token;
    if (oauthBearer.startsWith(oauthPrefix)) {
      oauthBearer = oauthBearer.substr(oauthPrefix.length);
    }
    return {
      baseURL: "https://api.twitch.tv/helix/",
      headers: {
        "Client-ID": config.twitch_client_id,
        "Authorization": `Bearer ${oauthBearer}`
      }
    };
  }

  // Function to handle token refresh using Twitch API
  static refreshToken() {
    return new Promise((resolve, reject) => {
      const url = 'https://id.twitch.tv/oauth2/token';
      const params = {
        client_id: config.twitch_client_id,
        client_secret: config.twitch_client_secret,
        grant_type: 'refresh_token',
        refresh_token: config.twitch_refresh_token,
      };

      axios.post(url, null, { params })
        .then((res) => {
          if (res.data && res.data.access_token) {
            // Update the tokens in config.json
            config.twitch_oauth_token = res.data.access_token;
            config.twitch_refresh_token = res.data.refresh_token;

            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

            console.log('[TwitchApi]', 'Token refreshed successfully');
            resolve(res.data.access_token);
          } else {
            reject('Failed to refresh token: No access_token received');
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  static handleApiError(err) {
    const res = err.response || {};

    if (res.data && res.data.status === 401) {  // 401 means Unauthorized, token might have expired
      console.error('[TwitchApi]', 'Token expired, trying to refresh token...');
      return this.refreshToken()
        .then((newToken) => {
          // Retry the failed request with the new token
          return Promise.resolve(newToken);
        })
        .catch((refreshError) => {
          console.error('[TwitchApi]', 'Failed to refresh token:', refreshError);
          return Promise.reject(refreshError);
        });
    } else {
      if (res.data && res.data.message) {
        console.error('[TwitchApi]', 'API request failed with Helix error:', res.data.message, `(${res.data.error}/${res.data.status})`);
      } else {
        console.error('[TwitchApi]', 'API request failed with error:', err.message || err);
      }
      return Promise.reject(err);
    }
  }

  static fetchStreams(channelNames) {
    return axios.get(`/streams?user_login=${channelNames.join('&user_login=')}`, this.requestOptions)
      .then((res) => res.data.data || [])
      .catch((err) => {
        return this.handleApiError(err).then(() => this.fetchStreams(channelNames));
      });
  }

  static fetchUsers(channelNames) {
    return axios.get(`/users?login=${channelNames.join('&login=')}`, this.requestOptions)
      .then((res) => res.data.data || [])
      .catch((err) => {
        return this.handleApiError(err).then(() => this.fetchUsers(channelNames));
      });
  }

  static fetchGames(gameIds) {
    return axios.get(`/games?id=${gameIds.join('&id=')}`, this.requestOptions)
      .then((res) => res.data.data || [])
      .catch((err) => {
        return this.handleApiError(err).then(() => this.fetchGames(gameIds));
      });
  }
}

module.exports = TwitchApi;
