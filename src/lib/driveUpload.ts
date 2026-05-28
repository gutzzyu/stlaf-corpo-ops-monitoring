export interface UploadMetadata {
  year: string;
  month: string;
  userName: string;
  entryId: string;
  category: 'Receipts' | 'Proof_Slips' | 'Reimbursements' | 'Generated_Reports';
  isPending?: boolean;
}

export async function uploadToDrive(file: File, metadata: UploadMetadata) {
  const token = localStorage.getItem('google_drive_token');
  const expiry = localStorage.getItem('google_drive_token_expiry');
  const isExpired = expiry && Date.now() > Number(expiry);

  if (!token || isExpired) {
    throw new Error('Google Drive session expired or missing. Please log out and log back in to reconnect your Drive.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('year', metadata.year);
  formData.append('month', metadata.month);
  formData.append('userName', metadata.userName);
  formData.append('entryId', metadata.entryId);
  formData.append('category', metadata.category);
  if (metadata.isPending !== undefined) {
    formData.append('isPending', metadata.isPending.toString());
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`
  };

  let response: Response;
  try {
    response = await fetch('/api/upload', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Cannot upload: Browser is blocking third-party cookies or redirects. Please click the pop-out icon at top right to open the app in a new tab.");
    }
    throw error;
  }

  const contentType = response.headers.get('content-type');
  let errorData: any = {};
  
  if (!response.ok) {
    if (contentType && contentType.includes('application/json')) {
      errorData = await response.json();
    } else {
      const text = await response.text();
      console.error('Server returned non-JSON error:', text);
      if (text.includes('Cookie check') || text.includes('Action required')) {
        throw new Error("Cannot upload: Browser is blocking third-party cookies. Please click the pop-out icon at top right to open the app in a new tab.");
      }
      throw new Error(`Server Error (${response.status}): The server returned an unexpected response. Please check if your connection is stable.`);
    }

    if (response.status === 401 || errorData.error === 'DRIVE_AUTH_ERROR') {
      localStorage.removeItem('google_drive_token');
      localStorage.removeItem('google_drive_token_expiry');
      throw new Error('Google Drive session expired. Please log out and log back in to reconnect your Drive.');
    }
    throw new Error(errorData.error || errorData.message || `Upload failed with status ${response.status}`);
  }

  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<{
      fileId: string;
      url: string;
      fileName: string;
    }>;
  } else {
    throw new Error('Server returned an unexpected response format. Please try again.');
  }
}

export async function deleteFileFromDrive(fileId: string) {
  const token = localStorage.getItem('google_drive_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch('/api/delete-file', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ fileId }),
    });
    
    if (!response.ok) {
        console.warn("Delete file non-ok:", await response.text());
    }
  } catch (err) {
    console.warn("Delete file fetch error:", err);
  }
}
