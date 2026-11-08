import {createSlideId, type ServiceItemId} from '../schema/ids';
import type {ServiceItemOf} from '../schema/service';
import {CREED_PRAYER_THEME_ID} from '../themes/creedPrayer';
import {LITURGY_SLIDES} from './liturgySlides';

export const APOSTLES_CREED_NEW =
  '나는 전능하신 아버지 하나님, 천지의 창조주를 믿습니다. 나는 그의 유일하신 아들, 우리 주 예수 그리스도를 믿습니다. 그는 성령으로 잉태되어 동정녀 마리아에게서 나시고, 본디오 빌라도에게 고난을 받아 십자가에 못 박혀 죽으시고, 장사된 지 사흘 만에 죽은 자 가운데서 다시 살아나셨으며, 하늘에 오르시어 전능하신 아버지 하나님 우편에 앉아 계시다가, 거기로부터 살아 있는 자와 죽은 자를 심판하러 오십니다. 나는 성령을 믿으며, 거룩한 공교회와 성도의 교제와 죄를 용서받는 것과 몸의 부활과 영생을 믿습니다. 아멘.';
export const APOSTLES_CREED_OLD =
  '전능하사 천지를 만드신 하나님 아버지를 내가 믿사오며, 그 외아들 우리 주 예수 그리스도를 믿사오니, 이는 성령으로 잉태하사 동정녀 마리아에게 나시고, 본디오 빌라도에게 고난을 받으사 십자가에 못 박혀 죽으시고, 장사한 지 사흘 만에 죽은 자 가운데서 다시 살아나시며, 하늘에 오르사 전능하신 하나님 우편에 앉아 계시다가, 저리로서 산 자와 죽은 자를 심판하러 오시리라. 성령을 믿사오며, 거룩한 공회와 성도가 서로 교통하는 것과, 죄를 사하여 주시는 것과, 몸이 다시 사는 것과, 영원히 사는 것을 믿사옵나이다. 아멘.';
export const LORDS_PRAYER_NEW =
  '하늘에 계신 우리 아버지, 아버지의 이름을 거룩하게 하시며, 아버지의 나라가 오게 하시며, 아버지의 뜻이 하늘에서와 같이 땅에서도 이루어지게 하소서. 오늘 우리에게 일용할 양식을 주시고, 우리가 우리에게 잘못한 사람을 용서하여 준 것같이 우리의 잘못을 용서하여 주시고, 우리를 시험에 빠지지 않게 하시고, 악에서 구하소서. 나라와 권능과 영광이 영원히 아버지의 것입니다. 아멘.';
export const LORDS_PRAYER_OLD =
  '하늘에 계신 우리 아버지여, 이름이 거룩히 여김을 받으시오며, 나라이 임하옵시며, 뜻이 하늘에서 이룬 것 같이 땅에서도 이루어지이다. 오늘날 우리에게 일용할 양식을 주옵시고, 우리가 우리에게 죄 지은 자를 사하여 준 것 같이 우리 죄를 사하여 주옵시고, 우리를 시험에 들게 하지 마옵시고, 다만 악에서 구하옵소서. 대개 나라와 권세와 영광이 아버지께 영원히 있사옵나이다. 아멘.';

export const LITURGY = {
  creed: {name: '사도신경', new: APOSTLES_CREED_NEW, old: APOSTLES_CREED_OLD},
  prayer: {name: '주기도문', new: LORDS_PRAYER_NEW, old: LORDS_PRAYER_OLD},
} as const;
export type LiturgyKind = keyof typeof LITURGY;
export type LiturgyTranslation = 'new' | 'old';

export function newLiturgyItem(
  id: ServiceItemId,
  {
    kind,
    translation,
  }: {
    readonly kind: LiturgyKind;
    readonly translation: LiturgyTranslation;
  },
): ServiceItemOf<'slides'> {
  return {
    id,
    theme: CREED_PRAYER_THEME_ID,
    slides: {
      form: 'blank',
      name: LITURGY[kind].name,
      slides: LITURGY_SLIDES[kind][translation].map(text => ({
        id: createSlideId(crypto.randomUUID()),
        text,
      })),
    },
  };
}
