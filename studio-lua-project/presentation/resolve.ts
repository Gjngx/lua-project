import {defineDocuments, defineLocations} from 'sanity/presentation'
import type {PresentationPluginOptions} from 'sanity/presentation'

export const resolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: defineDocuments([
    {
      route: '/',
      type: 'homePage',
    },
  ]),
  locations: {
    homePage: defineLocations({
      select: {},
      resolve: () => ({
        locations: [{title: 'Home page', href: '/'}],
      }),
    }),
    project: defineLocations({
      select: {title: 'title'},
      resolve: (document) => ({
        locations: [{title: document?.title || 'Home page', href: '/#works'}],
      }),
    }),
    category: defineLocations({
      select: {title: 'title'},
      resolve: (document) => ({
        locations: [{title: document?.title || 'Home page', href: '/#works'}],
      }),
    }),
  },
}
