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
    defineField({
      name: 'prominence',
      title: 'Display size',
      type: 'string',
      description: 'Controls how prominently this image appears on the playground sphere.',
      initialValue: 'medium',
      options: {
        list: [
          {title: 'Small', value: 'small'},
          {title: 'Medium', value: 'medium'},
          {title: 'Large', value: 'large'},
          {title: 'Featured (extra large)', value: 'featured'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'alt',
      media: 'image',
      prominence: 'prominence',
    },
    prepare({title, media, prominence}) {
      const sizeLabels: Record<string, string> = {
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        featured: 'Featured',
      }

      return {
        title: title || 'Decorative image',
        subtitle: sizeLabels[prominence] || 'Display size not selected',
        media,
      }
    },
  },
})
