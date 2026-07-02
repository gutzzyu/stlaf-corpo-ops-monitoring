export interface UploadMetadata {
  year: string;
  month: string;
  userName: string;
  entryId: string;
  category: 'Receipts' | 'Proof_Slips' | 'Reimbursements' | 'Generated_Reports';
  isPending?: boolean;
}

export async function uploadDirectToDrive(file: File, category: string, driveToken: string, userName?: string) {
  const formatDriveFileName = (origName: string, uName: string, cat: string) => {
    const dateStr = new Date().toISOString().split('T')[0];
    const finalUName = uName || 'User';
    const nameParts = finalUName.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : finalUName;
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join('_') : '';
    
    const sanitizedLastName = lastName.replace(/[^a-zA-Z0-9]/g, "");
    const sanitizedFirstName = firstName.replace(/[^a-zA-Z0-9]/g, "");
    
    const timestamp = Date.now();
    const lastDot = origName.lastIndexOf('.');
    const extension = lastDot !== -1 ? origName.substring(lastDot) : '';
    const docType = cat.replace(/_/g, "");
    return `${dateStr}_${sanitizedLastName}_${sanitizedFirstName}_${docType}_${timestamp.toString().slice(-4)}${extension}`;
  };

  const newFileName = formatDriveFileName(file.name, userName || 'User', category);

  const getOrCreateSTLAFFolder = async (token: string): Promise<string> => {
    try {
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name = 'STLAF' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")}&fields=files(id)`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          return searchData.files[0].id;
        }
      }
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'STLAF',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      if (createRes.ok) {
        const createData = await createRes.json();
        return createData.id;
      }
    } catch (e) {
      console.warn("Client-side drive folder search failed:", e);
    }
    return 'root';
  };

  const stlafFolderId = await getOrCreateSTLAFFolder(driveToken);

  const metadata = {
    name: newFileName,
    mimeType: file.type,
    parents: [stlafFolderId],
  };
  
  const boundary = 'stlaf_workflow_multipart_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;
  
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base = result.split(',')[1];
      resolve(base);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Transfer-Encoding: base64\r\n' +
    'Content-Type: ' + file.type + '\r\n\r\n' +
    base64Data +
    close_delim;

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${driveToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!uploadRes.ok) {
    const errTxt = await uploadRes.text();
    throw new Error(`Direct Drive upload failed: ${errTxt}`);
  }

  const driveFile = await uploadRes.json();
  
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${driveToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (e) {
    console.warn("Direct upload permissions failed:", e);
  }

  return {
    fileId: driveFile.id,
    url: `https://drive.google.com/file/d/${driveFile.id}/view?usp=drivesdk`,
    fileName: newFileName,
  };
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
    if (error.name === 'TypeError' || error.message?.toLowerCase().includes("failed to fetch") || error.message?.toLowerCase().includes("cookie check") || error.message?.toLowerCase().includes("cookies")) {
      console.warn("Proxy block detected on fetch catch, falling back to direct client-side Google Drive API upload...");
      return uploadDirectToDrive(file, metadata.category, token, metadata.userName);
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
      const lowerText = text.toLowerCase();
      if (lowerText.includes('cookie check') || lowerText.includes('action required') || response.status === 403 || response.status === 302) {
        console.warn("Proxy block detected on non-ok response, falling back to direct client-side Google Drive API upload...");
        return uploadDirectToDrive(file, metadata.category, token, metadata.userName);
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
    const textBody = await response.text();
    try {
      return JSON.parse(textBody) as {
        fileId: string;
        url: string;
        fileName: string;
      };
    } catch (e) {
      const lowerText = textBody.toLowerCase();
      if (lowerText.includes("cookie check") || lowerText.includes("action required")) {
        console.warn("Proxy text block detected, falling back to direct client-side Google Drive API upload...");
        return uploadDirectToDrive(file, metadata.category, token, metadata.userName);
      }
      throw new Error('Server returned an unexpected response format. Please try again.');
    }
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
