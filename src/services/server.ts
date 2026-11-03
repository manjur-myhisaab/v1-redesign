import {
  createRDK,
  rest,
  authentication,
  readMe,
  readItems,
  readItem,
  createItem,
  createItems,
  updateItem,
  updateItems,
  deleteItem,
  deleteItems,
  customEndpoint,
  registerUser,
} from '@rdk/sdk';

export const ALLOWED_SERVER_CONTROL_USER_IDS: string[] = [
  'efe697f0-c733-4d46-9bb9-64e313ed2bf5',
  'ac62c347-c723-4690-819d-d962a94e0ae2',
];

export interface ServerUrlPreset {
  label: string;
  value: string;
}

export const PRESET_SERVER_URLS: ServerUrlPreset[] = [
  { label: 'Playground (https://playground.myhisaab.com)', value: 'https://playground.myhisaab.com' },
  { label: 'Cozybear (https://cozybear.myhisaab.com)', value: 'https://cozybear.myhisaab.com' },
];

export const getEffectiveApiUrl = (): string => {
  try {
    const savedUrl = localStorage.getItem('custom_server_url');
    if (savedUrl && typeof savedUrl === 'string' && savedUrl.trim() !== '') {
      return savedUrl.trim().replace(/\/+$/, '');
    }
  } catch (e) {
    console.error('Error reading custom_server_url from localStorage:', e);
  }
  return ((import.meta.env.VITE_API_URL as string | undefined) || 'https://playground.myhisaab.com').replace(/\/+$/, '');
};

export const getEffectiveAttendanceUrl = (): string => {
  try {
    const savedUrl = localStorage.getItem('custom_server_url');
    if (savedUrl && typeof savedUrl === 'string' && savedUrl.trim() !== '') {
      return savedUrl.trim().replace(/\/+$/, '');
    }
  } catch (e) {
    console.error('Error reading custom_server_url from localStorage:', e);
  }
  return (
    (import.meta.env.VITE_ATTENDANCE_SERVER_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    'https://cozybear.myhisaab.com'
  ).replace(/\/+$/, '');
};

const API_URL = getEffectiveApiUrl();
const GOOGLE_MAP_KEY = (import.meta.env.VITE_GOOGLE_MAP_KEY as string | undefined) || '';
const ATTENDANCE_SERVER_URL = getEffectiveAttendanceUrl();

const createClientInstance = (token?: string | null) => {
  return createRDK(API_URL)
    .with(
      rest({
        onRequest: (options: any) => {
          const effectiveToken =
            token ||
            localStorage.getItem('authToken') ||
            localStorage.getItem('mh.token') ||
            '';
          if (effectiveToken) {
            options.headers = {
              ...options.headers,
              Authorization: `Bearer ${effectiveToken}`,
            };
          }
          return options;
        },
      })
    )
    .with(authentication());
};

export type AppRDKClient = ReturnType<typeof createClientInstance>;

const rdk: AppRDKClient = createClientInstance();

const updateRDKAuth = (token: string | null): void => {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
};

export const formatPhoneAsEmail = (phoneNumber: string): string => {
  const allDigits = phoneNumber.replace(/\D/g, '');
  return `${allDigits}@hisaab.reev.group`;
};

export const createNewEmployee = async (payload: {
  firm_company_code: string;
  first_name: string;
  last_name: string;
  password: string;
  contact_number: string;
  [key: string]: any;
}): Promise<any> => {
  try {
    console.log('createNewEmployee payload:', payload);
    const response = await rdk.request(
      customEndpoint({
        path: 'api/new_employee_new',
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    console.log('createNewEmployee response:', response);
    return response;
  } catch (error) {
    console.error('createNewEmployee error:', error);
    throw error;
  }
};

export const createNewBusiness = async (payload: {
  attendance_module?: boolean;
  firm_name: string;
  first_name: string;
  last_name: string;
  firm_employee_limit?: number;
  password: string;
  firm_contact_number: string;
  [key: string]: any;
}): Promise<any> => {
  try {
    console.log('createNewBusiness payload:', payload);
    const response = await rdk.request(
      customEndpoint({
        path: 'api/new_firm_new',
        method: 'POST',
        body: JSON.stringify({
          attendance_module: true,
          ...payload,
        }),
      })
    );
    console.log('createNewBusiness response:', response);
    return response;
  } catch (error) {
    console.error('createNewBusiness error:', error);
    throw error;
  }
};

export const uploadFiles = async (files: (File | Blob)[]): Promise<string[]> => {
  try {
    const token = localStorage.getItem('authToken');
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      return data.data.id as string;
    });

    const fileIds = await Promise.all(uploadPromises);
    return fileIds;
  } catch (error: any) {
    console.error('Failed to upload files:', error);
    throw new Error(error.message || 'Failed to upload files');
  }
};

export const signup = async (
  email: string,
  password: string,
  firstName: string = '',
  lastName: string = ''
): Promise<any> => {
  try {
    await rdk.request(
      registerUser(email, password, {
        first_name: firstName,
        last_name: lastName,
      })
    );

    const loginResponse = await login(email, password);
    return loginResponse;
  } catch (error: any) {
    console.error('RDK signup failed:', error);
    throw new Error(error.message || 'Signup failed');
  }
};

export const checkNewUser = async (phoneNumber: string): Promise<any> => {
  try {
    const response = await rdk.request(
      customEndpoint({
        path: `api/check_new_user/${phoneNumber}`,
        method: 'GET',
      })
    );
    console.log(response);
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const sendOtpViaSmsGateway = async (phoneNumber: string): Promise<any> => {
  try {
    console.log('sendOtpViaSmsGateway phone:', phoneNumber);
    const response: any = await rdk.request(
      customEndpoint({
        path: 'firebase/sendotp',
        method: 'POST',
        body: JSON.stringify({ phone_number: phoneNumber }),
      })
    );
    console.log('sendOtpViaSmsGateway response:', response);

    const isSuccess =
      response?.status === 'success' ||
      response?.success === true ||
      (response && !response.error && response.status !== 'error');

    if (isSuccess) {
      return response;
    } else {
      // Server returned error status
      throw new Error(response?.message || response?.data?.message || 'Failed to send OTP');
    }
  } catch (error) {
    console.error('sendOtpViaSmsGateway error:', error);
    throw error;
  }
};

export const verifyAndLoginViaSmsGateway = async (phoneNumber: string, otp: string): Promise<any> => {
  try {
    console.log('verifyAndLoginViaSmsGateway request:', { phoneNumber, otp });
    const response: any = await rdk.request(
      customEndpoint({
        path: 'firebase/connectsmsgateway',
        method: 'POST',
        body: JSON.stringify({
          phone_number: phoneNumber,
          id_token: otp,
        }),
      })
    );
    console.log('verifyAndLoginViaSmsGateway response:', response);

    const isSuccess =
      response?.status === 'success' ||
      response?.success === true ||
      (response && !response.error && response.status !== 'error');

    if (isSuccess) {
      const data = response?.data || response;
      if (data?.access_token) {
        localStorage.setItem('authToken', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refreshToken', data.refresh_token);
        }
        updateRDKAuth(data.access_token);
      }
      return response;
    } else {
      throw new Error(response?.message || response?.data?.message || 'OTP verification failed');
    }
  } catch (error) {
    console.error('verifyAndLoginViaSmsGateway error:', error);
    throw error;
  }
};

export const loginWithFirebaseToken = async (firebaseToken: string): Promise<any> => {
  try {
    const response: any = await rdk.request(
      customEndpoint({
        path: 'firebase/connect',
        method: 'POST',
        body: JSON.stringify({ id_token: firebaseToken }),
      })
    );
    if (response?.access_token) {
      localStorage.setItem('authToken', response.access_token);
      updateRDKAuth(response.access_token);
      const userData = getCurrentUser();
      return userData;
    } else if (response?.status === 'error') {
      const error: any = new Error('Registration required');
      error.code = 'REGISTRATION_REQUIRED';
      throw error;
    } else {
      throw new Error('Firebase authentication failed');
    }
  } catch (error: any) {
    console.error('Firebase login failed:', error);
    // Don't wrap the REGISTRATION_REQUIRED error so it propagates
    if (error.code === 'REGISTRATION_REQUIRED') {
      throw error;
    }
    throw new Error(error.message || 'Login failed');
  }
};

// Keep the original login method for backward compatibility
export const login = async (
  emailOrPayload: string | { email?: string; identifier?: string; password?: string; [key: string]: any },
  password?: string
): Promise<any> => {
  try {
    const payload: any =
      typeof emailOrPayload === 'string'
        ? { email: emailOrPayload, password: password || '' }
        : emailOrPayload;
    const response: any = await (rdk as any).login(payload);
    if (response?.access_token) {
      localStorage.setItem('authToken', response.access_token);
      updateRDKAuth(response.access_token);
    }
    return response;
  } catch (error: any) {
    console.error('RDK login failed:', error);
    throw new Error(error.message || 'Login failed');
  }
};

export const logout = async (): Promise<void> => {
  try {
    await rdk.logout();
    localStorage.removeItem('authToken');
    updateRDKAuth(null);
  } catch (error: any) {
    console.error('RDK logout failed:', error);
    throw new Error(error.message || 'Logout failed');
  }
};

export const getCurrentUser = async (): Promise<any> => {
  try {
    const token = localStorage.getItem('authToken') || localStorage.getItem('mh.token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    updateRDKAuth(token);
    const user = await rdk.request(
      readMe({
        fields: [
          '*',
          'firm_id.*',
          'firm_id.store_id.*',
          'other_category_ids.*',
          'employee_category_id.*',
          'manager_category_id.*',
          'designation_id.*',
          'all_firms.firm_id.*',
        ],
      })
    );
    return user;
  } catch (error: any) {
    console.error('Failed to fetch current user:', error);
    throw new Error(error.message || 'Failed to fetch user data');
  }
};

export interface CollectionItem {
  id: any;
  title: any;
  description: string;
  status: string;
  image: any;
  parent_collection: any;
  date_updated: any;
  sort: any;
}

export interface FetchCollectionsResult {
  collections: CollectionItem[];
  pagination: {
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
  };
}

export const fetchCollections = async (page: number = 1, perPage: number = 10): Promise<FetchCollectionsResult> => {
  try {
    console.log('Fetching collections with params:', { page, perPage });
    const response: any = await rdk.request(
      readItems('collections', {
        fields: ['*', 'parent_collection.*'],
        limit: perPage,
        page: page,
        sort: ['sort'],
      })
    );

    console.log('Raw collections response:', response);

    const collections: any[] = Array.isArray(response) ? response : (response?.data || []);
    const meta = response?.meta;

    return {
      collections: collections.map((collection: any) => ({
        id: collection.collection_id,
        title: collection.collection_name,
        description: collection.description || '',
        status: collection.status || 'draft',
        image: collection.image,
        parent_collection: collection.parent_collection?.collection_id || null,
        date_updated: collection.date_updated,
        sort: collection.sort,
      })),
      pagination: {
        hasNextPage: meta ? meta.filter_count > page * perPage : false,
        hasPrevPage: page > 1,
        total: meta?.filter_count || collections.length,
      },
    };
  } catch (error: any) {
    console.error('Failed to fetch collections:', error);
    throw new Error(error.message || 'Failed to fetch collections');
  }
};

// Leads-related functions
export interface LeadItem {
  id: any;
  name: any;
  email: any;
  phone: any;
  status: string;
  source: any;
  date_created: any;
  last_contacted: any;
}

export interface FetchLeadsResult {
  leads: LeadItem[];
  pagination: {
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
  };
}

export const fetchLeads = async (page: number = 1, perPage: number = 10): Promise<FetchLeadsResult> => {
  try {
    console.log('Fetching leads with params:', { page, perPage });
    const response: any = await rdk.request(
      readItems('leads', {
        fields: ['*'],
        limit: perPage,
        page: page,
        sort: ['-date_created'],
      })
    );

    const leads: any[] = Array.isArray(response) ? response : (response?.data || []);
    const meta = response?.meta;

    return {
      leads: leads.map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status || 'new',
        source: lead.source,
        date_created: lead.date_created,
        last_contacted: lead.last_contacted,
      })),
      pagination: {
        hasNextPage: meta ? meta.filter_count > page * perPage : false,
        hasPrevPage: page > 1,
        total: meta?.filter_count || leads.length,
      },
    };
  } catch (error: any) {
    console.error('Failed to fetch leads:', error);
    throw new Error(error.message || 'Failed to fetch leads');
  }
};

export const createLead = async (leadData: Record<string, any>): Promise<any> => {
  try {
    console.log('Creating lead with data:', leadData);
    const response = await rdk.request(createItem('leads', leadData));
    console.log('Create lead response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to create lead:', error);
    throw new Error(error.message || 'Failed to create lead');
  }
};

export const updateLead = async (id: string | number, leadData: Record<string, any>): Promise<any> => {
  try {
    console.log('Updating lead with data:', { id, ...leadData });
    const response = await rdk.request(updateItem('leads', id, leadData));
    console.log('Update lead response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to update lead:', error);
    throw new Error(error.message || 'Failed to update lead');
  }
};

export const deleteLeads = async (ids: (string | number)[]): Promise<any> => {
  try {
    console.log('Deleting leads:', ids);
    const response = await rdk.request(deleteItems('leads', ids as any));
    console.log('Delete leads response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to delete leads:', error);
    throw new Error(error.message || 'Failed to delete leads');
  }
};

export interface CollectionDetails {
  id: any;
  title: any;
  description: string;
  parent_collection: any;
  parent_collection_name?: any;
  status: any;
  image: any;
  date_updated: any;
  sort: any;
}

export const fetchCollectionById = async (id: string | number): Promise<CollectionDetails> => {
  try {
    console.log('Fetching collection by id:', id);
    const response: any = await rdk.request(
      readItem('collections', id, {
        fields: ['*', 'parent_collection.*'],
      })
    );
    console.log('Collection details response:', response);

    return {
      id: response.collection_id,
      title: response.collection_name,
      description: response.description || '',
      parent_collection: response.parent_collection?.collection_id || 'none',
      parent_collection_name: response.parent_collection?.collection_name,
      status: response.status,
      image: response.image,
      date_updated: response.date_updated,
      sort: response.sort,
    };
  } catch (error: any) {
    console.error('Failed to fetch collection:', error);
    throw new Error(error.message || 'Failed to fetch collection');
  }
};

export const createCollection = async (collectionData: Record<string, any>): Promise<any> => {
  try {
    console.log('Creating collection with data:', collectionData);

    const { id: _id, title, parent_collection, ...rest } = collectionData;

    const payload = {
      collection_name: title,
      parent_collection: parent_collection === 'none' ? null : parent_collection,
      ...rest,
    };

    console.log('Sending payload to server:', payload);
    const response = await rdk.request(createItem('collections', payload));
    console.log('Create collection response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to create collection:', error);
    throw new Error(error.message || 'Failed to create collection');
  }
};

export const updateCollection = async (id: string | number, collectionData: Record<string, any>): Promise<any> => {
  try {
    console.log('Updating collection with data:', { id, ...collectionData });
    const { title, parent_collection, ...rest } = collectionData;

    const payload = {
      collection_name: title,
      parent_collection: parent_collection === 'none' ? null : parent_collection,
      ...rest,
    };

    console.log('Sending update payload to server:', payload);
    const response = await rdk.request(updateItem('collections', id, payload));
    console.log('Update collection response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to update collection:', error);
    throw new Error(error.message || 'Failed to update collection');
  }
};

export const deleteCollections = async (ids: (string | number)[]): Promise<any> => {
  try {
    console.log('Deleting collections:', ids);
    const response = await rdk.request(deleteItems('collections', ids as any));
    console.log('Delete collections response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to delete collections:', error);
    throw new Error(error.message || 'Failed to delete collections');
  }
};

export const createProduct = async (productData: Record<string, any>): Promise<any> => {
  try {
    const response = await rdk.request(createItem('products', productData));
    return response;
  } catch (error: any) {
    console.error('Failed to create product:', error);
    throw new Error(error.message || 'Failed to create product');
  }
};

export const updateProduct = async (id: string | number, productData: Record<string, any>): Promise<any> => {
  try {
    const response = await rdk.request(updateItem('products', id, productData));
    return response;
  } catch (error: any) {
    console.error('Failed to update product:', error);
    throw new Error(error.message || 'Failed to update product');
  }
};

export const getProduct = async (id: string | number): Promise<any> => {
  try {
    const response = await rdk.request(
      readItem('products', id, {
        fields: ['*', 'variations.variants_variant_id.*', 'variations.variants_variant_id.images.directus_files_id.*'],
      })
    );
    return response;
  } catch (error: any) {
    console.error('Failed to fetch product:', error);
    throw new Error(error.message || 'Failed to fetch product');
  }
};

export const deleteProduct = async (id: string | number): Promise<any> => {
  try {
    const response = await rdk.request(deleteItem('products', id));
    return response;
  } catch (error: any) {
    console.error('Failed to delete product:', error);
    throw new Error(error.message || 'Failed to delete product');
  }
};

export const createTransfer = async (transferData: Record<string, any>): Promise<any> => {
  try {
    const response = await rdk.request(createItem('stock_transfer', transferData));
    return response;
  } catch (error: any) {
    console.error('Failed to create transfer:', error);
    throw new Error(error.message || 'Failed to create transfer');
  }
};

export const fetchStoreProductsPage = async (
  storeId: string | number,
  perPageItems: number,
  pageNumber: number
): Promise<any> => {
  try {
    const response = await rdk.request(
      customEndpoint({
        path: `api/store_products_page`,
        params: {
          store_id: storeId,
          perPageItems: perPageItems,
          pageNumber: pageNumber,
        },
      })
    );

    return response;
  } catch (error: any) {
    console.error('Failed to fetch store products page:', error);
    throw new Error(error.message || 'Failed to fetch store products page');
  }
};

// Tag-related functions
export const fetchTags = async (): Promise<any[]> => {
  try {
    const response: any = await rdk.request(
      readItems('tags', {
        fields: ['tag_id', 'name'],
        sort: ['name'],
      })
    );
    return Array.isArray(response) ? response : response?.data || [];
  } catch (error: any) {
    console.error('Failed to fetch tags:', error);
    throw new Error(error.message || 'Failed to fetch tags');
  }
};

export const createTag = async (tagName: string): Promise<any> => {
  try {
    const response = await rdk.request(
      createItem('tags', {
        name: tagName.trim(),
      })
    );
    return response;
  } catch (error: any) {
    console.error('Failed to create tag:', error);
    throw new Error(error.message || 'Failed to create tag');
  }
};

// Staff-related functions
export interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  status: string;
  start_date: string;
  [key: string]: any;
}

export interface FetchStaffResult {
  staff: StaffMember[];
  pagination: {
    hasNextPage: boolean;
    hasPrevPage: boolean;
    total: number;
  };
}

export const fetchStaff = async (page: number = 1, perPage: number = 10): Promise<FetchStaffResult> => {
  try {
    console.log('Fetching staff with params:', { page, perPage });
    // For now, return mock data since we don't have the actual API endpoint
    const mockStaffData: StaffMember[] = [
      {
        id: '1',
        name: 'John Doe',
        position: 'Software Engineer',
        department: 'Engineering',
        status: 'Active',
        start_date: '2023-01-15T09:00:00.000Z',
      },
      {
        id: '2',
        name: 'Jane Smith',
        position: 'Product Manager',
        department: 'Product',
        status: 'Active',
        start_date: '2022-11-20T09:00:00.000Z',
      },
      {
        id: '3',
        name: 'Mike Johnson',
        position: 'UI Designer',
        department: 'Design',
        status: 'On Leave',
        start_date: '2023-03-10T09:00:00.000Z',
      },
      {
        id: '4',
        name: 'Sarah Williams',
        position: 'Marketing Specialist',
        department: 'Marketing',
        status: 'Active',
        start_date: '2023-02-01T09:00:00.000Z',
      },
      {
        id: '5',
        name: 'David Brown',
        position: 'Sales Representative',
        department: 'Sales',
        status: 'Inactive',
        start_date: '2022-09-05T09:00:00.000Z',
      },
    ];

    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedStaff = mockStaffData.slice(startIndex, endIndex);

    return {
      staff: paginatedStaff,
      pagination: {
        hasNextPage: endIndex < mockStaffData.length,
        hasPrevPage: page > 1,
        total: mockStaffData.length,
      },
    };
  } catch (error: any) {
    console.error('Failed to fetch staff:', error);
    throw new Error(error.message || 'Failed to fetch staff');
  }
};

export const createStaffMember = async (staffData: Record<string, any>): Promise<any> => {
  try {
    console.log('Creating staff member with data:', staffData);
    const response = await rdk.request(createItem('staff', staffData));
    console.log('Create staff member response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to create staff member:', error);
    throw new Error(error.message || 'Failed to create staff member');
  }
};

export const updateStaffMember = async (id: string | number, staffData: Record<string, any>): Promise<any> => {
  try {
    console.log('Updating staff member with data:', { id, ...staffData });
    const response = await rdk.request(updateItem('staff', id, staffData));
    console.log('Update staff member response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to update staff member:', error);
    throw new Error(error.message || 'Failed to update staff member');
  }
};

export const deleteStaff = async (ids: (string | number)[]): Promise<any> => {
  try {
    console.log('Deleting staff members:', ids);
    const response = await rdk.request(deleteItems('staff', ids as any));
    console.log('Delete staff members response:', response);
    return response;
  } catch (error: any) {
    console.error('Failed to delete staff members:', error);
    throw new Error(error.message || 'Failed to delete staff members');
  }
};

const storedToken = localStorage.getItem('authToken') || localStorage.getItem('mh.token');
if (storedToken) {
  updateRDKAuth(storedToken);
}

// Utility function to capitalize first letter of each word
export const capitalizeWords = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export {
  readMe,
  readItems,
  readItem,
  deleteItem,
  deleteItems,
  customEndpoint,
  updateItem,
  updateItems,
  createItem,
  createItems,
  GOOGLE_MAP_KEY,
  ATTENDANCE_SERVER_URL,
  API_URL,
};
export default rdk;

