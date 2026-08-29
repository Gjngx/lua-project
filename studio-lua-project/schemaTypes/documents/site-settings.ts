import {CogIcon} from '@sanity/icons/Cog'
import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'favicon',
      title: 'Favicon',
      type: 'image',
      description: 'Global browser icon. Upload a square PNG image, at least 32×32px.',
    }),
    defineField({
      name: 'audioPlaylist',
      title: 'Music playlist',
      type: 'array',
      description:
        'Upload MP3 files and drag tracks to control their playback order across the website. Local tracks are used when this list is empty.',
      of: [defineArrayMember({type: 'audioTrack'})],
    }),
    defineField({
      name: 'hoverSound',
      title: 'Hover sound',
      type: 'file',
      description:
        'Upload the MP3 effect played when the pointer enters links and interactive elements.',
      options: {accept: 'audio/mpeg,.mp3'},
    }),
    defineField({
      name: 'closeSound',
      title: 'Close sound',
      type: 'file',
      description: 'Upload the MP3 effect played when hovering the menu Close button.',
      options: {accept: 'audio/mpeg,.mp3'},
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Site settings',
        subtitle: 'Global website configuration',
        media: CogIcon,
      }
    },
  },
})
