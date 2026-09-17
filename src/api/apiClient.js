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