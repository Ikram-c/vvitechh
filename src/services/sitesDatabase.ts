import { SiteDefinition } from '../types';

export const SITES_DATABASE: SiteDefinition[] = [
  {
    name: "Instagram",
    aliases: ["ig", "insta", "gram", "instagram"],
    hosts: ["instagram.com", "cdninstagram.com", "instagram.fbcdn.net"],
    notes: "Feed images are resized to 1080 px on the long side (1080x1080, 1080x1350 or 1080x566), re-encoded as JPEG (roughly q70-80, 4:2:0) with metadata stripped; stories/reels are transcoded to H.264 around 1080x1920."
  },
  {
    name: "Facebook",
    aliases: ["fb", "facebook", "meta"],
    hosts: ["facebook.com", "fbcdn.net", "fbsbx.com", "fb.com"],
    notes: "Photos are capped at 2048 px (720/960/2048 variants) and re-encoded as JPEG around q70-85; PNGs are usually converted to JPEG. Videos are transcoded to H.264 with a bitrate cap that depends on resolution."
  },
  {
    name: "Threads",
    aliases: ["threads", "meta threads"],
    hosts: ["threads.net", "threads.com"],
    notes: "Shares Instagram's pipeline: 1080 px long side JPEG, metadata stripped; served from cdninstagram.com hosts."
  },
  {
    name: "X (Twitter)",
    aliases: ["x", "twitter", "tweet", "twtr", "x.com"],
    hosts: ["x.com", "twitter.com", "twimg.com", "t.co"],
    notes: "Images above 4096 px are downscaled, most uploads are re-encoded as JPEG (q~85, 4:2:0) or served as WebP; PNGs with transparency may be kept as PNG. Videos are transcoded to H.264 (several bitrate ladders, 1080p max)."
  },
  {
    name: "TikTok",
    aliases: ["tiktok", "tt", "douyin"],
    hosts: ["tiktok.com", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokv.com", "musical.ly"],
    notes: "Videos are transcoded to H.264/H.265 at up to 1080p with aggressive bitrate targets; cover images become JPEG/WebP."
  },
  {
    name: "YouTube",
    aliases: ["yt", "youtube", "youtu.be", "shorts"],
    hosts: ["youtube.com", "youtu.be", "ytimg.com", "ggpht.com", "googlevideo.com"],
    notes: "Videos are re-encoded into AVC/VP9/AV1 ladders (144p-4K); thumbnails are JPEG/WebP around q80 at 1280x720 max."
  },
  {
    name: "Reddit",
    aliases: ["reddit", "rdt", "redd.it", "subreddit"],
    hosts: ["reddit.com", "redd.it", "redditmedia.com", "redditstatic.com", "reddituploads.com"],
    notes: "Original images are kept up to 20 MB but previews are re-encoded (JPEG/WebP, downscaled); v.redd.it videos are transcoded to DASH H.264."
  },
  {
    name: "Discord",
    aliases: ["discord", "dc", "discordapp"],
    hosts: ["discord.com", "discordapp.com", "discordapp.net", "discord.gg"],
    notes: "Files below the upload cap are stored untouched; media.discordapp.net previews are resized/converted to WebP on the fly (look at the ?format=&width= query)."
  },
  {
    name: "LinkedIn",
    aliases: ["linkedin", "li", "licdn"],
    hosts: ["linkedin.com", "licdn.com", "lnkd.in"],
    notes: "Images are re-encoded as JPEG with multiple sizes (up to ~1280-1920 px long side); videos are transcoded to H.264 720p/1080p."
  },
  {
    name: "Pinterest",
    aliases: ["pinterest", "pin", "pinimg"],
    hosts: ["pinterest.com", "pinimg.com", "pin.it"],
    notes: "Pins are stored at up to 1200-2000 px on the long side (originals/736x/564x variants) as JPEG q~80 or WebP."
  },
  {
    name: "Bluesky",
    aliases: ["bluesky", "bsky", "blue sky", "at proto"],
    hosts: ["bsky.app", "bsky.social", "bsky.network", "atproto.com"],
    notes: "Uploads are limited to ~1 MB; images are downscaled to 2000 px and re-encoded as JPEG (feed thumbnails are WebP from cdn.bsky.app)."
  },
  {
    name: "Mastodon",
    aliases: ["mastodon", "fediverse", "masto"],
    hosts: ["mastodon.social", "mastodon.online", "mstdn.social", "mas.to", "fosstodon.org", "hachyderm.io"],
    notes: "Default server settings shrink images to ~1920x1080 (2 MP) JPEG q~85 and cap video size/bitrate; each instance can differ."
  },
  {
    name: "WhatsApp",
    aliases: ["whatsapp", "wa", "whats app"],
    hosts: ["whatsapp.com", "whatsapp.net"],
    notes: "Standard image sends are downscaled to ~1600 px long side and re-encoded as JPEG (q~70-80); 'HD' keeps more resolution. Videos are heavily transcoded."
  },
  {
    name: "Telegram",
    aliases: ["telegram", "tg", "tele"],
    hosts: ["telegram.org", "t.me", "telegram.me", "telesco.pe", "telegra.ph"],
    notes: "Photos sent as photos are resized to 1280 px long side JPEG q~87; 'send as file' keeps the original. Videos are re-encoded unless sent as files."
  },
  {
    name: "Snapchat",
    aliases: ["snapchat", "snap"],
    hosts: ["snapchat.com", "sc-cdn.net", "snap.com"],
    notes: "Snaps and stories are re-encoded (JPEG / H.264) at phone resolution; saved media differs from what viewers receive."
  },
  {
    name: "Signal",
    aliases: ["signal", "signal messenger"],
    hosts: ["signal.org"],
    notes: "Standard quality resizes to ~1600 px and re-encodes as JPEG; 'High' quality keeps ~3072 px. No public CDN URLs."
  },
  {
    name: "Messenger",
    aliases: ["messenger", "fb messenger", "facebook messenger"],
    hosts: ["messenger.com"],
    notes: "Uses Facebook's image pipeline (2048 px max, JPEG re-encode) unless files are sent as attachments."
  },
  {
    name: "Tumblr",
    aliases: ["tumblr", "tmblr"],
    hosts: ["tumblr.com", "media.tumblr.com", "tmblr.co"],
    notes: "Images are served in size ladders (up to 2048 px) as JPEG/WebP; GIFs are size-capped."
  },
  {
    name: "Imgur",
    aliases: ["imgur", "imgr"],
    hosts: ["imgur.com", "imgur.io"],
    notes: "Large JPEGs are re-encoded and images above ~20 MB are downscaled; animated GIFs become MP4/GIFV."
  },
  {
    name: "Flickr",
    aliases: ["flickr", "flkr"],
    hosts: ["flickr.com", "staticflickr.com", "flic.kr"],
    notes: "Originals can be kept (Pro) while display sizes (Large 1024/1600/2048) are re-encoded JPEG q~90."
  },
  {
    name: "500px",
    aliases: ["500px", "five hundred px"],
    hosts: ["500px.com", "500px.org"],
    notes: "Display versions are re-encoded JPEG at 2048 px; originals are not served publicly."
  },
  {
    name: "Google Photos",
    aliases: ["google photos", "gphotos", "photos"],
    hosts: ["photos.google.com", "googleusercontent.com", "photos.app.goo.gl"],
    notes: "'Storage saver' re-encodes at 16 MP / 1080p; 'Original quality' keeps files. Shared links serve resized JPEG/WebP."
  },
  {
    name: "Other / custom",
    aliases: ["other", "custom", "unknown", "website", "blog"],
    hosts: [],
    notes: "Any other site or messaging app. The measured numbers still tell you exactly what it did."
  }
];

export function detectSiteFromUrl(url: string): SiteDefinition | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();
    for (const site of SITES_DATABASE) {
      if (site.hosts.some(h => host === h || host.endsWith('.' + h))) {
        return site;
      }
    }
  } catch {
    // If not a valid URL yet, check text
    const lower = url.toLowerCase();
    for (const site of SITES_DATABASE) {
      if (site.hosts.some(h => lower.includes(h))) {
        return site;
      }
    }
  }
  return null;
}

export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();

  if (!q) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 + (100 - t.length);
  if (t.includes(q)) return 500 + (100 - t.length);

  // Subsequence matching
  let qIdx = 0;
  let score = 100;
  let consecutive = 0;

  for (let tIdx = 0; tIdx < t.length && qIdx < q.length; tIdx++) {
    if (t[tIdx] === q[qIdx]) {
      score += 15; // match
      if (consecutive > 0) {
        score += 20 * consecutive; // consecutive bonus
      }
      if (tIdx === 0 || " -_./(,".includes(t[tIdx - 1])) {
        score += 30; // word separator bonus
      }
      consecutive++;
      qIdx++;
    } else {
      consecutive = 0;
      score -= 1; // unmatched penalty
    }
  }

  return qIdx === q.length ? score : -1;
}

export function searchSites(query: string): SiteDefinition[] {
  if (!query.trim()) {
    return SITES_DATABASE;
  }

  const scored = SITES_DATABASE.map(site => {
    let bestScore = fuzzyScore(query, site.name);
    for (const alias of site.aliases) {
      const aliasScore = fuzzyScore(query, alias);
      if (aliasScore > bestScore) {
        bestScore = aliasScore;
      }
    }
    return { site, score: bestScore };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.site);
}
