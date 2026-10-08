import { useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import type { DetectionResult, DetectionState, BulkItemResult } from '@/types/detection';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120_000, // 2 min — model inference can be slow on CPU
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('trudrishti_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('trudrishti_user');
      localStorage.removeItem('trudrishti_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export function useDetection() {
  const [state, setState] = useState<DetectionState>({
    result:      null,
    bulkResults: null,
    loading:     false,
    error:       null,
    imageFile:   null,
    imageUrl:    null,
    imageFiles:  [],
    imageUrls:   [],
  });

  const detect = useCallback(async (input: File | File[]) => {
    const isBulk = Array.isArray(input);

    if (isBulk) {
      const files = input;
      const urls = files.map(file => URL.createObjectURL(file));

      setState({
        result:      null,
        bulkResults: null,
        loading:     true,
        error:       null,
        imageFile:   null,
        imageUrl:    null,
        imageFiles:  files,
        imageUrls:   urls,
      });

      const form = new FormData();
      files.forEach(file => {
        form.append('files', file);
      });

      try {
        const { data } = await api.post<{ results: BulkItemResult[] }>('/detect-bulk?include_visuals=true', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        setState(prev => ({
          ...prev,
          loading:     false,
          bulkResults: data.results,
        }));
      } catch (err) {
        let message = 'An unexpected error occurred. Please try again.';

        if (err instanceof AxiosError) {
          if (!err.response) {
            message = `Cannot reach the API at ${API_BASE}. Make sure the backend is running.`;
          } else {
            const detail = err.response.data?.detail;
            message = typeof detail === 'string' ? detail : `Server error (${err.response.status}).`;
          }
        }

        setState(prev => ({
          ...prev,
          loading: false,
          error:   message,
        }));
      }
    } else {
      const file = input;
      const imageUrl = URL.createObjectURL(file);

      setState({
        result:      null,
        bulkResults: null,
        loading:     true,
        error:       null,
        imageFile:   file,
        imageUrl,
        imageFiles:  [],
        imageUrls:   [],
      });

      const form = new FormData();
      form.append('file', file);

      try {
        const { data } = await api.post<DetectionResult>('/detect?include_visuals=true', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        setState(prev => ({
          ...prev,
          loading: false,
          result:  data,
        }));
      } catch (err) {
        let message = 'An unexpected error occurred. Please try again.';

        if (err instanceof AxiosError) {
          if (!err.response) {
            message = `Cannot reach the API at ${API_BASE}. Make sure the backend is running.`;
          } else {
            const detail = err.response.data?.detail;
            message = typeof detail === 'string' ? detail : `Server error (${err.response.status}).`;
          }
        }

        setState(prev => ({
          ...prev,
          loading: false,
          error:   message,
        }));
      }
    }
  }, []);

  const reset = useCallback(() => {
    setState(prev => {
      if (prev.imageUrl) URL.revokeObjectURL(prev.imageUrl);
      prev.imageUrls.forEach(url => URL.revokeObjectURL(url));
      return {
        result:      null,
        bulkResults: null,
        loading:     false,
        error:       null,
        imageFile:   null,
        imageUrl:    null,
        imageFiles:  [],
        imageUrls:   [],
      };
    });
  }, []);

  return { ...state, detect, reset };
}
