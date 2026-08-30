import {defineDocuments, defineLocations} from 'sanity/presentation'
import type {PresentationPluginOptions} from 'sanity/presentation'

export const resolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: defineDocuments([
    {
      route: '/',
      type: 'homePage',
    },
    {
      route: '/let-talk',
      type: 'letTalkPage',
    },
  ]),
  locations: {
    footer: defineLocations({
      select: {},
      resolve: () => ({
        locations: [{title: 'Footer', href: '/'}],
      }),
    }),
    homePage: defineLocations({
      select: {},
      resolve: () => ({
        locations: [{title: 'Home page', href: '/'}],
      }),
    }),
    letTalkPage: defineLocations({
      select: {},
      resolve: () => ({
        locations: [{title: "Let's Talk page", href: '/let-talk'}],
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
