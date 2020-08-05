const tmi = require('tmi.js');
const fs = require('fs');

config = JSON.parse(fs.readFileSync("config.json"))
channels = config.channels

const client = new tmi.Client({
	options: { debug: true },
	connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: config.username,
		password: config.oauth
	},
	channels: channels
});

client.connect();

data = JSON.parse(fs.readFileSync("banned_users.json"))

channels.forEach(function(channel) {
  console.log(channel)
  if (!(channel in data)) {
    data[channel] = {}
    console.log(data)
  }
})
update_file()

function update_file() {
  fs.writeFileSync("banned_users.json", JSON.stringify(data));
}

function emoteban(channel, sourceuser, target) {
  if (sourceuser == target) {
    return
  }

  data[channel][target] = {
    "starttime": Date.now(),
    "mod": sourceuser
  }

  console.log(`Emotebanned ${target}.`)
  update_file()
}

function emotetimeout(channel, sourceuser, target, duration) {
  if (sourceuser == target) {
    return
  }

  if (duration.endsWith("m")) {
    duration = parseInt(duration) * 60
  }
  else if (duration.endsWith("h")) {
    duration = parseInt(duration) * 3600
  } else {
    duration = parseInt(duration) * 1
  }

  data[channel][target] = {
    "starttime": Date.now(),
    "mod": sourceuser,
    "duration": duration,
    "endtime": Date.now() + duration * 1000
  }

  console.log(`Emotebanned ${target} for ${duration}s.`)
  update_file()
}

function emoteunban(channel, sourceuser, target) {
  if (sourceuser == target) {
    return
  }

  delete data[channel][target]

  console.log(`Emoteunbanned ${target}.`)
  update_file()
}

function must_delete_message(channel, sourceuser, tags, message) {
  if(tags["emote-only"] != true && sourceuser in data[channel]) {
    if ("endtime" in data[channel][sourceuser]) {
      console.log(`${Date.now()} is smaller than ${data[channel][sourceuser]["endtime"]}`)
      return Date.now() < data[channel][sourceuser]["endtime"]
    } else {
      return true;
    }
  }
  return false;
}

function do_delete_message(channel, id) {
  client.deletemessage(channel, id);
}

function is_mod(tags) {
  return tags.mod || (tags.badges != null && "broadcaster" in tags.badges)
}

client.on('message', (channel, tags, message, self) => {
  try {
    if (self) return;
    
    if (is_mod(tags) && null !== (matches = /^!emoteban\s+@?([a-zA-Z0-9_]+)$/gi.exec(message))) {
      return emoteban(channel, String(tags["username"]), String(matches[1]))
    }

    if (is_mod(tags) && null !== (matches = /^!emoteunban\s+@?([a-zA-Z0-9_]+)$/gi.exec(message))) {
      return emoteunban(channel, String(tags["username"]), String(matches[1]))
    }

    if (is_mod(tags) && null !== (matches = /^!emotetimeout\s+@?([a-zA-Z0-9_]+)\s+([0-9]+[smh]?)$/gi.exec(message))) {
      return emotetimeout(channel, String(tags["username"]), String(matches[1]), String(matches[2]))
    }

    if (is_mod(tags) && null !== (matches = /^!emoteuntimeout\s+@?([a-zA-Z0-9_]+)$/gi.exec(message))) {
      return emoteunban(channel, String(tags["username"]), String(matches[1]))
    }

    if (must_delete_message(channel, String(tags["username"]), tags, message)) {
      do_delete_message(channel, tags["id"])
    }
  }
  catch(err) {
    console.error(err)
  }
});
