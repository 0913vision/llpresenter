import {expect, it} from 'vitest';
import {LORDS_PRAYER_NEW, LORDS_PRAYER_OLD} from '@core/services/liturgy';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';

// NOTE(0913vision): The fixed prayer texts are read aloud in the service, so they
// match the church's printed texts letter by letter (새번역: the church's 주기도문
// poster), spacing and commas included.
const NEW_PRAYER =
  '하늘에 계신 우리 아버지, 아버지의 이름을 거룩하게 하시며, 아버지의 나라가 오게 하시며, 아버지의 뜻이 하늘에서와 같이 땅에서도 이루어지게 하소서. 오늘 우리에게 일용할 양식을 주시고, 우리가 우리에게 잘못한 사람을 용서하여 준 것같이, 우리 죄를 용서하여 주시고, 우리를 시험에 빠지지 않게 하시고 악에서 구하소서. 나라와 권능과 영광이 영원히 아버지의 것입니다. 아멘.';
const OLD_PRAYER =
  '하늘에 계신 우리 아버지여, 이름이 거룩히 여김을 받으시오며, 나라이 임하옵시며, 뜻이 하늘에서 이룬 것 같이 땅에서도 이루어지이다. 오늘날 우리에게 일용할 양식을 주옵시고, 우리가 우리에게 죄 지은 자를 사하여 준 것 같이 우리 죄를 사하여 주옵시고, 우리를 시험에 들게 하지 마옵시고, 다만 악에서 구하옵소서. 대개 나라와 권세와 영광이 아버지께 영원히 있사옵나이다. 아멘.';

it("keeps the Lord's Prayer texts exactly as published", () => {
  expect(LORDS_PRAYER_NEW).toBe(NEW_PRAYER);
  expect(LORDS_PRAYER_OLD).toBe(OLD_PRAYER);
});

it('splits the prayer slides without changing a letter', () => {
  expect(LITURGY_SLIDES.prayer.new.join(' ')).toBe(NEW_PRAYER);
  expect(LITURGY_SLIDES.prayer.old.join(' ')).toBe(OLD_PRAYER);
});
