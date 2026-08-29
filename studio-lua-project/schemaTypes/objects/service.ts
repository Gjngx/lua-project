import {ControlsIcon} from '@sanity/icons/Controls'
import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'service',
  title: 'Service',
  type: 'object',
  icon: ControlsIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Service title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'specialties',
      title: 'Specialties',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'image',
      title: 'Service image',
      type: 'image',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'image',
      specialties: 'specialties',
    },
    prepare({title, media, specialties}) {
      return {
        title,
        media,
        subtitle: Array.isArray(specialties) ? specialties.join(' • ') : undefined,
      }
    },
  },
})
