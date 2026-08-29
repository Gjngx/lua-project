import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'bw57chik',
    dataset: 'production'
  },
  deployment: {
    /**
     * Bundle the installed Studio dependencies during deploy. This avoids
     * relying on sanity-cdn.com while the Studio is being built.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: false,
  },
})
