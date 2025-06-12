import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function generateBOQ(file, standard) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('standard', standard);

  try {
    const response = await axios.post(`${API_BASE_URL}/api/boq`, formData);
    if (response.data && response.data.error) {
      throw new Error(response.data.error);
    }
    return response.data;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message || 'An unknown error occurred.';
    throw new Error(errorMsg);
  }
}

// --- DEFINITIVELY FIXED FUNCTION ---
export async function downloadExcelWithCost(boqItems) {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/generate_excel`, { boqItems }, {
      responseType: 'blob', // We expect a file, but we will check the content type to be sure
    });

    // Get the content type from the response headers
    const contentType = response.headers['content-type'];

    // If the server sent back a JSON error message instead of a file, handle it.
    if (contentType && contentType.includes('application/json')) {
        // To read the error message from the blob, we need to convert it to text
        const errorText = await new Response(response.data).text();
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || 'The server returned an unspecified error.');
    }

    // If we received the correct spreadsheet content type, proceed with the download.
    if (contentType && contentType.includes('spreadsheetml')) {
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'boq_with_costing.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } else {
        // Handle cases where the response is neither a valid file nor a JSON error
        throw new Error('Received an unexpected response format from the server.');
    }

  } catch (err) {
    // This will catch network errors or the errors we threw above.
    throw new Error(err.message || 'Could not download the Excel file.');
  }
}
