import { baseApi } from '@/services/baseApi'
import { cleanParams } from '@/utils/format'

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCategoryTree: build.query({
      query: () => '/categories',
      transformResponse: (response) => response.data.categories,
      providesTags: ['CategoryTree'],
    }),
    getCategory: build.query({
      query: (slug) => `/categories/${slug}`,
      transformResponse: (response) => response.data.category,
      providesTags: ['CategoryTree'],
    }),
    getProducts: build.query({
      query: (params) => ({ url: '/products', params: cleanParams(params) }),
      transformResponse: (response) => response.data,
    }),
    getProduct: build.query({
      query: (slug) => `/products/${slug}`,
      transformResponse: (response) => response.data, // { product, related }
    }),
    getStore: build.query({
      query: (slug) => `/stores/${slug}`,
      transformResponse: (response) => response.data.store,
    }),
  }),
})

export const {
  useGetCategoryTreeQuery,
  useGetCategoryQuery,
  useGetProductsQuery,
  useGetProductQuery,
  useGetStoreQuery,
} = catalogApi
