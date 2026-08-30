import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'letTalkPage',
  title: "Let's Talk page",
  type: 'document',
  icon: EnvelopeIcon,
  fields: [
    defineField({
      name: 'heroImages',
      title: 'Hero images',
      type: 'array',
      description: 'Upload exactly four images. They rotate once per second on the website.',
      of: [
        defineArrayMember({
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
        }),
      ],
      validation: (rule) => rule.required().length(4),
    }),
    defineField({
      name: 'services',
      title: 'Services',
      type: 'array',
      description: 'Enter exactly four service labels.',
      of: [
        defineArrayMember({
          name: 'letTalkService',
          title: 'Service',
          type: 'object',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {title: 'label'},
          },
        }),
      ],
      validation: (rule) => rule.required().length(4),
    }),
  ],
  initialValue: {
    services: [
      {_key: 'ui-ux-design', _type: 'letTalkService', label: 'UI/UX Design'},
      {_key: 'website-design', _type: 'letTalkService', label: 'Website Design'},
      {_key: 'digital-design', _type: 'letTalkService', label: 'Digital Design'},
      {_key: 'branding', _type: 'letTalkService', label: 'Branding'},
    ],
  },
  preview: {
    prepare() {
      return {
        title: "Let's Talk page",
        subtitle: 'Hero images and services',
      }
    },
  },
})
