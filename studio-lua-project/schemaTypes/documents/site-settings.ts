import {CogIcon} from '@sanity/icons/Cog'
import {defineArrayMember, defineField, defineType} from 'sanity'

const linkValidation = (value: string | undefined) => {
  if (!value || value === '#' || value.startsWith('/') || /^https?:\/\//.test(value)) {
    return true
  }

  return 'Use #, an internal path starting with /, or a full http(s) URL.'
}

export default defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'socialProfiles',
      title: 'Social links',
      description: 'Shared profile links used by both the footer and navigation menu.',
      type: 'object',
      options: {collapsible: false},
      fields: [
        defineField({
          name: 'linkedin',
          title: 'LinkedIn',
          type: 'string',
          validation: (rule) => rule.custom(linkValidation),
        }),
        defineField({
          name: 'instagram',
          title: 'Instagram',
          type: 'string',
          validation: (rule) => rule.custom(linkValidation),
        }),
        defineField({
          name: 'facebook',
          title: 'Facebook',
          type: 'string',
          validation: (rule) => rule.custom(linkValidation),
        }),
        defineField({
          name: 'dribbble',
          title: 'Dribbble',
          type: 'string',
          validation: (rule) => rule.custom(linkValidation),
        }),
      ],
    }),
    // Preserve the previous array format while editing moves to four fixed fields.
    defineField({
      name: 'socialLinks',
      type: 'array',
      hidden: true,
      readOnly: true,
      of: [defineArrayMember({
        name: 'socialLink',
        type: 'object',
        fields: [
          defineField({name: 'platform', type: 'string'}),
          defineField({name: 'href', type: 'string'}),
        ],
      })],
    }),
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
