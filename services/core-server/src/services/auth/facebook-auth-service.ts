import axios from 'axios';
import { config } from '../../config';
import { AuthenticationError, BadRequestError } from '../../utils/errors';

type FacebookDebugTokenResponse = {
  data?: {
    app_id?: string;
    is_valid?: boolean;
    user_id?: string;
  };
};

type FacebookUserResponse = {
  id: string;
  name?: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
};

export type FacebookUser = {
  id: string;
  name: string;
  email: string;
  picture?: string;
};

const graphBaseUrl = 'https://graph.facebook.com/v21.0';

async function validateAccessToken(accessToken: string) {
  if (!config.facebookAppId || !config.facebookAppSecret) {
    return;
  }

  const appAccessToken = `${config.facebookAppId}|${config.facebookAppSecret}`;
  const { data } = await axios.get<FacebookDebugTokenResponse>(`${graphBaseUrl}/debug_token`, {
    params: {
      input_token: accessToken,
      access_token: appAccessToken,
    },
  });

  const tokenData = data.data;
  if (!tokenData?.is_valid || tokenData.app_id !== config.facebookAppId) {
    throw new AuthenticationError('Invalid Facebook access token');
  }
}

export async function getFacebookUser(accessToken: string): Promise<FacebookUser> {
  if (!accessToken) {
    throw new BadRequestError('Facebook access token is required');
  }

  await validateAccessToken(accessToken);

  const { data } = await axios.get<FacebookUserResponse>(`${graphBaseUrl}/me`, {
    params: {
      fields: 'id,name,email,picture.type(large)',
      access_token: accessToken,
    },
  });

  if (!data.id || !data.email) {
    throw new BadRequestError('Facebook account email permission is required');
  }

  return {
    id: data.id,
    name: data.name || data.email.split('@')[0],
    email: data.email.toLowerCase(),
    picture: data.picture?.data?.url,
  };
}
