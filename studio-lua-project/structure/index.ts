import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
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
      S.listItem()
        .title('Footer')
        .icon(EarthGlobeIcon)
        .child(S.document().schemaType('footer').documentId('footer').title('Footer')),
      S.divider(),
      S.documentTypeListItem('project').title('Projects').icon(ProjectsIcon),
      S.documentTypeListItem('category').title('Categories').icon(TagIcon),
      ...S.documentTypeListItems().filter(
        (item) => !['homePage', 'footer', 'project', 'category'].includes(item.getId() ?? ''),
      ),
    ])
