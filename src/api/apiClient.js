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

// Dedicated APIFreaks GET request helper (DNS History, and any future APIFreaks-backed tool).
export const getApiFreaksRequest = async (url, params = {}, config = {}) => {
  try {
    const response = await axios.get(url, {
      params,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    })
    return { data: response.data, success: true }
  } catch (error) {
    const status = error.response?.status
    const apiMessage = error.response?.data?.message || error.response?.data?.error

    if (status === 401 || status === 403) {
      return { error, success: false, status, message: apiMessage || 'Invalid or missing APIFreaks API key.' }
    }
    if (status === 402) {
      return { error, success: false, status, message: apiMessage || 'Out of APIFreaks credits for this account.' }
    }
    if (status === 404) {
      return { error, success: false, status: 404, message: apiMessage || 'No records found.' }
    }
    if (status === 429) {
      return { error, success: false, status: 429, message: apiMessage || 'Rate limited — please wait a moment and try again.' }
    }
    return {
      error, success: false, status,
      message: apiMessage || (status ? `APIFreaks returned HTTP ${status}` : 'APIFreaks request failed'),
    }
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