'use strict';

const http = require('node:http');
const { createHash, randomUUID } = require('node:crypto');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const MAX_BODY_BYTES = 1024 * 1024;
const accounts = new Map();

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function hashId(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

function findDeviceId(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeviceId(item);
      if (found) return found;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value)) {
    if (/^device[-_]?id$/i.test(key) && typeof item === 'string' && item.length > 0) return item;
  }
  for (const item of Object.values(value)) {
    const found = findDeviceId(item);
    if (found) return found;
  }
  return null;
}

function getOrCreateUser(deviceId) {
  const accountKey = hashId(deviceId);
  // Stumble Guys 0.56 deserializes User.Id as Int32, not a string.
  const id = Number.parseInt(accountKey.slice(0, 7), 16) || 1;
  if (!accounts.has(accountKey)) {
    const created = new Date().toISOString();
    accounts.set(accountKey, {
      Id: id,
      StumbleId: accountKey,
      DeviceId: String(deviceId).slice(0, 128),
      ScopelyJWT: '',
      Username: `Player${String(id).slice(-6)}`,
      Country: '', Region: '', Token: '', Version: '0.56', VersionResult: '',
      Friends: [], Skins: [], SkinVariants: [], Rewards: [], Balances: [],
      Created: created, LastLogin: created, SkillRating: 0, Crowns: 0,
      HiddenRating: 0, Experience: 0, NewsVersion: 0,
      AvailableNewsVersion: 0, LatestNewsIdBackend: 0,
      Emotes: [], Animations: [], Footsteps: [], HasBattlePass: false,
      PassTokens: 0, FreePassRewards: [], PremiumPassRewards: [],
      KidFriendlyMode: 1, Age: 0, TermsOfServiceAccepted: false,
      FeaturesEnabled: [],
      BattlePass: {
        PassID: 0, PassTokens: 0, HasPurchased: false,
        FreePassRewards: [], PremiumPassRewards: [], SecondsToEnd: 0
      },
      SecondsSinceCreated: 0,
      RewardID: '', PhotonJwt: '', NativeId: '', PlatformType: 0,
      Inventory: [], InventoryShards: {}
    });
  }
  const user = accounts.get(accountKey);
  user.LastLogin = new Date().toISOString();
  return user;
}

const sharedData = {
  CustomPartySettings: {}, FriendsListSettings: {}, RewardPacks: [],
  BattlePass: {}, BattlePasses: [], Currencies: {}, PurchasableItems: [],
  AdSettings: {
    UseTestAds: false, UseRewardedAdLimit: false, AdRankLimit: 0,
    RewardedDisabled: true, RewardedCount: 0,
    AgeSettings: { AskAge: false, Countries: [] },
    InterstitialSettings: {
      DefaultDisableInterstitials: true,
      DefaultIntervalSeconds: 86400,
      CountrySettings: []
    },
    TestDevices: [], DisableForDevices: []
  },
  ShopDef: {
    Categories: [], OfferRotations_v2: [], OfferPopupMinSeconds: 0,
    Offers_v2: [], Gachas: [],
    LuckySpinWheel: {
      Id: '', ShopItemHeader: '', ShopItemDescription: '', ShopItemBackgroundImage: '',
      PopupHeader: '', PopupSubHeader: '', PopupDescription: '', PopupBackgroundImage: '',
      SpinHeader: '', LuckySpinWheelPurchasableItem: '', RotationItemList: [],
      SpinVisualDropsList: [], DropChancesVisuals: {}, AdSpinCooldownSeconds: 86400,
      GlobalResetTimeSeconds: 86400, RawGlobalResetTimeSeconds: 86400,
      GlobalResetTimeOffsetSeconds: 0, AdSpinMaxAmountPerCycle: 0, SpinMode: null
    },
    ClassicSpinWheel: {}, LuckySpinWheelPurchasableItems: [], CreatorCode: {}
  }, MatchmakingPools: [], Levels: [], Skins_v4: [],
  Footsteps_v2: [], Emotes_v2: [], Animations_v2: [], RoundLevels_v2: [],
  RoundRewards: [], GeneralSettings: {}, InGameNotifications: {}, Versions: {},
  SupportSettings: {}, PhotonSettings: {}, UseFirebase: false, DisableAdmob: true,
  DisableAds: true, BackendUrl: 'https://sgzy-production.up.railway.app', SharedType: '', AnalyticsSettings: {},
  _SharedVersion: 1, PusherSettings: {}, GameEvents: [],
  GameEventProgressions: [], GameEventXPTypes: [], GameEventsLeaderboardRewards: [],
  Missions: [], MissionRequirementTypes: [], MissionObjectives: [],
  LocalNotifications: {}, EndOfMatchReward: {}, Shards: {}, Themes: {}
};

sharedData.Shards = {
  DuplicateBank: [],
  RarityCost: {},
  ShardsSources: {},
  ShardsToDuplicateBankXp: {}
};

async function handle(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  const method = req.method || 'GET';

  if (method === 'GET' && (path === '/' || path === '/health')) {
    return sendJson(res, 200, {
      service: 'StumbleZyx backend', status: 'online', apiReadiness: 'partial',
      implementedRoutes: ['POST /user/login', 'GET /user/config', 'GET /user/profile/:id', 'GET /user/refresheconomy', 'POST /user/inventory/selection', 'GET /user/steampricesv2', 'GET /usersettings', 'GET /collection-events/me', 'GET /game-events/me/', 'GET /user/news', 'GET /shared/:version/:type', 'GET /api/v1/ping'],
      multiplayerReady: false,
      note: 'Prototype guest backend; data is in memory and resets on restart.'
    });
  }

  if (method === 'GET' && path === '/api/v1/ping') {
    return sendJson(res, 200, { success: true, status: 'online' });
  }

  if (method === 'GET' && path === '/user/config') {
    // The 0.56 client deserializes this response directly as SharedData.
    const config = {
      ...sharedData,
      BackendUrl: 'https://sgzy-production.up.railway.app',
      SharedType: 'user',
      _SharedVersion: 1
    };
    const etag = `"${createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 24)}"`;
    return sendJson(res, 200, config, { etag });
  }

  if (method === 'POST' && path === '/user/login') {
    let body = {};
    try { body = await readJson(req); }
    catch (error) {
      if (error.status === 413) throw error;
      // Some 0.56 client builds send a wrapped or non-JSON guest payload.
      // Keep login guest-only and continue with a fresh anonymous ID.
    }
    const suppliedDeviceId = findDeviceId(body);
    const deviceId = suppliedDeviceId && suppliedDeviceId.length <= 256
      ? suppliedDeviceId
      : `guest-${randomUUID()}`;
    const user = getOrCreateUser(deviceId);
    return sendJson(res, 200, {
      User: user,
      TermsOfServiceAccepted: false,
      PhotonJwt: '',
      FeatureFlags: []
    });
  }

  const profile = path.match(/^\/user\/profile\/([^/]+)$/i);
  if (method === 'GET' && profile) {
    const user = [...accounts.values()].find((entry) => String(entry.Id) === profile[1] || entry.StumbleId === profile[1]);
    if (!user) return sendJson(res, 404, { error: 'profile_not_found' });
    return sendJson(res, 200, user);
  }

  if (method === 'GET' && path === '/user/refresheconomy') {
    return sendJson(res, 200, { Balances: [], Inventory: [], InventoryShards: {} });
  }

  if (method === 'POST' && path === '/user/inventory/selection') {
    // The prototype stores no selectable inventory; acknowledge the no-op.
    return sendJson(res, 200, { success: true });
  }
  if (method === 'GET' && path === '/user/steampricesv2') {
    // Purchaser.GetSteamPrices deserializes this response as List<SteamPurchasePrice>.
    return sendJson(res, 200, []);
  }
  if (method === 'GET' && path === '/usersettings') {
    return sendJson(res, 200, {
      FriendIsOnlinePush: false,
      InvitedToPartyPush: false,
      PartyInviteToastNotification: false,
      PartyInviteInGameToastNotification: false
    });
  }
  if (method === 'GET' && path === '/collection-events/me') {
    return sendJson(res, 200, { CollectionEvents: [] });
  }
  if (method === 'GET' && /^\/game-events\/me\/?$/i.test(path)) {
    return sendJson(res, 200, { GameEvents: [] });
  }
  if (method === 'GET' && (path === '/user/news' || path === '/news/getall')) {
    return sendJson(res, 200, []);
  }

  const shared = path.match(/^\/shared\/([^/]+)\/([^/]+)$/i);
  if (method === 'GET' && shared) {
    const requestedVersion = Number.parseInt(shared[1], 10);
    return sendJson(res, 200, {
      ...sharedData,
      BackendUrl: 'https://sgzy-production.up.railway.app',
      _SharedVersion: Number.isFinite(requestedVersion) ? requestedVersion : 1,
      SharedType: shared[2]
    });
  }

  if (path.startsWith('/user/') || path.startsWith('/round/') || path.startsWith('/api/v1/')) {
    return sendJson(res, 501, {
      error: 'endpoint_not_implemented',
      message: 'This game API is not implemented by the prototype backend.'
    });
  }
  return sendJson(res, 404, { error: 'not_found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!res.headersSent) sendJson(res, error.status || 500, { error: error.status === 400 ? 'invalid_request' : 'server_error' });
    else res.destroy();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`StumbleZyx backend listening on ${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error('Backend failed to start:', error.message);
  process.exitCode = 1;
});
