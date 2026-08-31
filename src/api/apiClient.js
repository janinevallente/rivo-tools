import axios from 'axios'

// Generic GET request helper
export const getRequest = async (url, params = {}, headers = {}, config = {}) => {
  try {
    const response = await axios.get(url, {
      params,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...config,
    })
    return { data: response.data, success: true }
  } catch (error) {
    return { error, success: false }
  }
}

// Dedicated RDAP GET request helper
export const getRdapRequest = async (url, params = {}, config = {}) => {
  try {
    const response = await axios.get(url, {
      params,
      headers: {
        'Accept': 'application/rdap+json',
        'Content-Type': 'application/json',
      },
      ...config,
    })
    return { data: response.data, success: true }
  } catch (error) {
    // Check if it's a 404 specifically
    if (error.response?.status === 404) {
      return { 
        error, 
        success: false, 
        status: 404,
        message: 'No RDAP record found for this query.'
      }
    }
    return { 
      error, 
      success: false, 
      status: error.response?.status,
      message: error.response?.status 
        ? `RDAP server returned HTTP ${error.response.status}`
        : 'RDAP request failed'
    }
  }
}

// Dedicated WHOIS/RDAP GET request helper (who-dat.as93.net) — free, no API key,
// no CORS issues. Queries RDAP first and falls back to WHOIS server-side, so it
// covers far more TLDs than calling RDAP directly.
export const getWhoisRequest = async (url, params = {}, config = {}) => {
  try {
    const response = await axios.get(url, {
      params,
      headers: {
        'Accept': 'application/json',
      },
      ...config,
    })
    return { data: response.data, success: true }
  } catch (error) {
    const status = error.response?.status
    const apiMessage = error.response?.data?.error?.message

    if (status === 501) {
      return {
        error,
        success: false,
        status: 501,
        message: apiMessage || 'No RDAP or WHOIS source is available for this TLD.',
      }
    }
    if (status === 400) {
      return {
        error,
        success: false,
        status: 400,
        message: apiMessage || 'Invalid or unparseable domain.',
      }
    }
    if (status === 429) {
      return {
        error,
        success: false,
        status: 429,
        message: apiMessage || 'Rate limited — please wait a moment and try again.',
      }
    }
    return {
      error,
      success: false,
      status,
      message: apiMessage || (status ? `WHOIS lookup server returned HTTP ${status}` : 'WHOIS request failed'),
    }
  }
}