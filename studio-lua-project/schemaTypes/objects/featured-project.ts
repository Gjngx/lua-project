import {ProjectsIcon} from '@sanity/icons/Projects'
import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'featuredProject',
  title: 'Featured project',
  type: 'object',
  icon: ProjectsIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Project title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'Project link',
      type: 'string',
      description: 'Use an internal path or a full external URL.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Project image',
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
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {layout: 'tags'},
      validation: (rule) => rule.required().min(1).unique(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'image',
      categories: 'categories',
    },
    prepare({title, media, categories}) {
      return {
        title,
        media,
        subtitle: Array.isArray(categories) ? categories.join(' • ') : undefined,
      }
    },
  },
})
