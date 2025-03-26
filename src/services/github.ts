
import { supabase } from '@/integrations/supabase/client';

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  language: string;
  visibility: string;
}

export async function getUserRepositories(username: string): Promise<GithubRepo[]> {
  try {
    const { data, error } = await supabase.functions.invoke('github-api', {
      body: {
        endpoint: `users/${username}/repos`,
        params: {
          sort: 'updated',
          per_page: 10
        }
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching GitHub repositories:', error);
    throw error;
  }
}

export async function getRepository(owner: string, repo: string): Promise<GithubRepo> {
  try {
    const { data, error } = await supabase.functions.invoke('github-api', {
      body: {
        endpoint: `repos/${owner}/${repo}`
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching GitHub repository:', error);
    throw error;
  }
}

export async function getUser(username: string): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('github-api', {
      body: {
        endpoint: `users/${username}`
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching GitHub user:', error);
    throw error;
  }
}
