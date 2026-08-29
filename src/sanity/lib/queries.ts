import { defineQuery } from 'groq';

export const FOOTER_QUERY = defineQuery(`
  *[_id == "footer"][0]{
    _id,
    _type,
    headline,
    primaryActionLabel,
    conversationLabel,
    email,
    phoneLabel,
    phoneNumber,
    creditGroups[]{
      _key,
      _type,
      label,
      contributors[]{
        _key,
        _type,
        name,
        href
      }
    },
    socialLinks[]{
      _key,
      _type,
      platform,
      href
    }
  }
`);

export const HOME_PAGE_QUERY = defineQuery(`
  *[_id == "homePage"][0]{
    _id,
    _type,
    seo{
      title,
      description,
      shareImage{
        ...,
        asset->{_id, url, metadata{lqip, dimensions}}
      }
    },
    hero{
      availabilityMessage,
      headline,
      role,
      location,
      introduction,
      aboutLink
    },
    featuredWork{
      heading,
      description,
      closingStatement,
      "projects": selectedProjects[]{
        _key,
        ...@->{
          _id,
          _type,
          title,
          "slug": slug.current,
          summary,
          url,
          coverImage{
            ...,
            asset->{_id, url, metadata{lqip, dimensions}}
          },
          "categories": categories[]->title
        }
      }
    },
    capabilities{
      introduction,
      services[]{
        _key,
        _type,
        title,
        specialties,
        image{
          ...,
          asset->{_id, url, metadata{lqip, dimensions}}
        }
      }
    },
    playground{
      leadIn,
      link,
      gallery[]{
        _key,
        _type,
        alt,
        prominence,
        image{
          ...,
          asset->{_id, url, metadata{lqip, dimensions}}
        }
      }
    }
  }
`);
