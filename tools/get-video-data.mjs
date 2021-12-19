#!/usr/bin/env node
// get-video-data --- Use youtube search api to get info on all out videos.

import { mkdir, readFile, writeFile } from 'fs/promises';
import slugify from 'slugify';
import fetch from 'node-fetch';

const API_URL = 'https://www.googleapis.com/youtube/v3/';

const outFile = 'data/youtube-videos.json';

const {youtube} = JSON.parse(
  await readFile('tools/api-keys.json', 'utf8')
);
const { channelId, apiKey } = youtube;

const playlists = await getChannelPlaylistInfo(channelId, apiKey);
const videos = await getChannelVideoInfo(channelId, apiKey);

await writeFile(outFile, JSON.stringify({videos, playlists}, null, 2));
console.log(`Found video info for ${videos.length} videos and ${playlists.length} playlists.`);
console.log(`Written to ${outFile}.`);

// Returns id, title, and itemCount and videos for each channel-defined playlist.
async function getChannelPlaylistInfo(channelId, key) {
  const params = new URLSearchParams({
    key, channelId,
    part: 'snippet,contentDetails',
    maxResults: 50,
  });

  const resp = await fetch(`${API_URL}playlists?${params}`);
  const json = await resp.json();

  const results = json.items.map(playlist => {
    return {
      id: playlist.id,
      title: playlist.snippet.title,
      itemCount: playlist.contentDetails.itemCount
    };
  });

  // Populate the video ids for each playlist.
  for (const playlist of results) {
    const videos = await getPlaylistVideoInfo(playlist.id, "contentDetails", key);
    playlist.videos = videos.map(video => video.contentDetails.videoId);
  }

  return results;
}

async function getChannelVideoInfo(channelId, key) {
  const uploadPlaylist = await getUploadPlaylist(channelId, key);
  return await getPlaylistVideoInfo(uploadPlaylist, 'snippet,contentDetails', key);
}

async function getPlaylistVideoInfo(playlistId, part, key) {
  const params = new URLSearchParams({
    key, part, playlistId,
    maxResults: 50
  });

  const results = [];

  while (true) {
    const resp = await fetch(`${API_URL}playlistItems?${params}`);
    const json = await resp.json();
    results.push(...json.items);
    if (!json.nextPageToken) {
      return results;
    }
    params.set('pageToken', json.nextPageToken);
  }
}

// The "upload stream" is defined as a playlist.
async function getUploadPlaylist(channelId, key) {
  const channelParams = new URLSearchParams({
    key,
    id: channelId,
    part: 'contentDetails'
  });

  const resp = await fetch(`${API_URL}channels?${channelParams}`);
  const json = await resp.json();
  return json.items[0].contentDetails.relatedPlaylists.uploads;
}
