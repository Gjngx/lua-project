import {PlayIcon} from '@sanity/icons/Play'
import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'audioTrack',
  title: 'Audio track',
  type: 'object',
  icon: PlayIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Track title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'audio',
      title: 'MP3 file',
      type: 'file',
      options: {accept: 'audio/mpeg,.mp3'},
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      filename: 'audio.asset.originalFilename',
    },
    prepare({title, filename}) {
      return {
        title: title || 'Untitled track',
        subtitle: filename || 'No MP3 uploaded',
        media: PlayIcon,
      }
    },
  },
})
