/* global WIKI */

// ------------------------------------
// Discord Account
// ------------------------------------

const DiscordStrategy = require('passport-discord').Strategy
const _ = require('lodash')

const request = require('request-promise')

/**
 * Helper function to return json data from discord api used by bot
 */
function getDiscordData(path, botToken) {
  const options = {
    uri: `https://discord.com/api${path}`,
    headers: {
      'Authorization': `Bot ${botToken}`
    },
    json: true
  }
  console.log(options)

  return request(options)
    .then((data) => {
      return data
    })
    .catch((err) => {
      console.log('Discord bot API call', err.name, err.message)
    })
}

module.exports = {
  init (passport, conf) {
    passport.use('discord',
      new DiscordStrategy({
        clientID: conf.clientId,
        clientSecret: conf.clientSecret,
        authorizationURL: 'https://discord.com/api/oauth2/authorize?prompt=none',
        callbackURL: conf.callbackURL,
        scope: 'identify email guilds',
        passReqToCallback: true
      }, async (req, accessToken, refreshToken, profile, cb) => {
        try {
          if (conf.guildId && !_.some(profile.guilds, { id: conf.guildId })) {
            throw new WIKI.Error.AuthLoginFailed()
          }
          // if there is a guildId and bot token then match the correct nick and groups
          if (conf.guildId && conf.botToken) {
            // get the users member data
            const guildMemberData = await getDiscordData(`/guilds/${conf.guildId}/members/${profile.id}`, conf.botToken)
            profile.nick = guildMemberData.nick
            // get the users roles in the guild
            const guildRoles = await getDiscordData(`/guilds/${conf.guildId}/roles`, conf.botToken)
            // match the members roles to the guild roles and grab the names
            const memberRoles = guildMemberData.roles.map((roleId) => guildRoles.find((role) => role.id === roleId).name)
            profile.groups = memberRoles
          }

          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              ...profile,
              displayName: profile.nick ? profile.nick : profile.username,
              picture: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      }
      ))
  }
}
