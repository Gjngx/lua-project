import {HomeIcon} from '@sanity/icons/Home'
import {ProjectsIcon} from '@sanity/icons/Projects'
import {TagIcon} from '@sanity/icons/Tag'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Website content')
    .items([
      S.listItem()
        .title('Home page')
        .icon(HomeIcon)
        .child(S.document().schemaType('homePage').documentId('homePage').title('Home page')),
      S.divider(),
      S.documentTypeListItem('project').title('Projects').icon(ProjectsIcon),
      S.documentTypeListItem('category').title('Categories').icon(TagIcon),
      ...S.documentTypeListItems().filter(
        (item) => !['homePage', 'project', 'category'].includes(item.getId() ?? ''),
      ),
    ])
