import {ImageIcon} from '@sanity/icons/Image'
import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'playgroundItem',
  title: 'Playground image',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'alt',
      title: 'Alternative text',
      type: 'string',
      description:
        'Describe the image for screen readers. Leave blank only when purely decorative.',
    }),
  ],
  preview: {
    select: {
      title: 'alt',
      media: 'image',
    },
    prepare({title, media}) {
      return {
        title: title || 'Decorative image',
        media,
      }
    },
  },
})
