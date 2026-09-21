import { Text, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LegalDocument, { legalStyles as styles } from '../components/layout/LegalDocument';
import { SUPPORT_EMAIL } from '../constants/contact';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityGuidelines'>;

export default function CommunityGuidelinesScreen({ navigation }: Props) {
  return (
    <LegalDocument
      title="Community guidelines"
      lastUpdated="August 30, 2026"
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.intro}>
        Axis works because students look out for each other. These guidelines keep
        the marketplace welcoming, honest, and safe. Break them and you may lose
        access to Axis.
      </Text>

      <Text style={styles.sectionTitle}>Be respectful</Text>
      <Text style={styles.paragraph}>
        Treat every student the way you would want to be treated. Keep messages
        polite, communicate clearly, and honor the deals you agree to. A little
        courtesy goes a long way on a campus you share.
      </Text>

      <Text style={styles.sectionTitle}>No prohibited or illegal items</Text>
      <Text style={styles.paragraph}>
        Do not list anything illegal or unsafe, including alcohol, drugs, weapons,
        stolen goods, counterfeit items, or anything that violates your school's
        policies. If it wouldn't be allowed on campus, it doesn't belong on Axis.
      </Text>

      <Text style={styles.sectionTitle}>No harassment or scams</Text>
      <Text style={styles.paragraph}>
        Harassment, hate speech, threats, and discrimination are never tolerated.
        Do not attempt to scam other students, post fake listings, ask for payment
        outside an agreed exchange, or pressure anyone into a deal.
      </Text>

      <Text style={styles.sectionTitle}>Nothing sexually explicit</Text>
      <Text style={styles.paragraph}>
        Listings, photos, profiles, and messages must stay free of
        sexually explicit or otherwise objectionable content. This is enforced on
        our servers, not just in the app — some language is rejected the moment
        you try to post it.
      </Text>

      <Text style={styles.sectionTitle}>Meet safely on campus</Text>
      <Text style={styles.paragraph}>
        Arrange to meet in busy, public spots on campus during daylight, such as
        the student center or library. Inspect items before you pay, and never
        share more personal information than a transaction requires.
      </Text>

      <Text style={styles.sectionTitle}>Reporting</Text>
      <Text style={styles.paragraph}>
        If you see a listing or message that breaks these guidelines, report it so
        our team can review it. You can also block users you no longer want to hear
        from. Reports are confidential and help keep Axis safe for everyone.
      </Text>
      <Text style={styles.paragraph}>
        Our team reviews every report. Content that
        violates these guidelines is removed, and the accounts responsible for it
        are suspended or permanently banned from Axis.
      </Text>
      <Text style={styles.paragraph}>
        For anything urgent, or if you'd rather reach us directly, email{' '}
        <Text
          style={styles.emailLink}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accessibilityRole="link"
        >
          {SUPPORT_EMAIL}
        </Text>
        .
      </Text>
      <Text style={styles.paragraph}>
        These are also published at{' '}
        <Text
          style={styles.emailLink}
          onPress={() => Linking.openURL('https://dataaxis.org/guidelines')}
          accessibilityRole="link"
        >
          dataaxis.org/guidelines
        </Text>
        .
      </Text>
    </LegalDocument>
  );
}
