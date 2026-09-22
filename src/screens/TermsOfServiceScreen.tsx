import { Text, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LegalDocument, { legalStyles as styles } from '../components/layout/LegalDocument';
import { SUPPORT_EMAIL } from '../constants/contact';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

export default function TermsOfServiceScreen({ navigation }: Props) {
  return (
    <LegalDocument
      title="Terms of service"
      lastUpdated="September 22, 2026"
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.intro}>
        Welcome to Axis. By creating an account or using the app you agree to
        these terms. They keep the marketplace fair and safe for every student.
      </Text>

      <Text style={styles.sectionTitle}>Eligibility</Text>
      <Text style={styles.paragraph}>
        Axis is only for members of the Western University community. You must
        be at least 13 years old, sign up with a valid @uwo.ca or @alumni.uwo.ca
        email address, and complete verification. If we learn that an account
        belongs to someone under 13, we remove it. You are responsible for
        keeping your login credentials secure and for all activity on your
        account.
      </Text>

      <Text style={styles.sectionTitle}>About Axis</Text>
      <Text style={styles.paragraph}>
        Axis is an independent service. It is not affiliated with, endorsed by,
        sponsored by, or operated by Western University. We refer to Western and
        its email domains only to describe who can join, and Western's names and
        marks belong to the university.
      </Text>

      <Text style={styles.sectionTitle}>Acceptable use</Text>
      <Text style={styles.paragraph}>
        Use Axis honestly and respectfully. Do not post misleading listings,
        impersonate others, spam, or attempt to access accounts that are not
        yours. You may not use the app for any unlawful purpose or in a way that
        disrupts the service for other students.
      </Text>

      <Text style={styles.sectionTitle}>Objectionable content</Text>
      <Text style={styles.paragraph}>
        There is no tolerance for objectionable content or abusive behaviour on
        Axis. You may not post or send content that is harassing, hateful,
        threatening, sexually explicit, discriminatory, or otherwise objectionable,
        in any listing, photo, message, or profile. Report anything that
        breaks this rule and our team will review it. Content that
        violates these terms or our Community Guidelines is removed, and the
        accounts responsible for it are suspended or permanently banned from Axis.
      </Text>

      <Text style={styles.sectionTitle}>Listings and transactions</Text>
      <Text style={styles.paragraph}>
        You are responsible for the items you list, including their accuracy,
        pricing, condition, and legality. Transactions happen directly between
        buyers and sellers. Axis is a platform to connect students; we are not a
        party to any sale and do not process payments or guarantee any item.
        Always confirm details and meet safely before exchanging money.
      </Text>

      <Text style={styles.sectionTitle}>Disclaimer of liability</Text>
      <Text style={styles.paragraph}>
        Axis is provided "as is" without warranties of any kind. We are not
        responsible for the quality, safety, or legality of listed items, the
        conduct of users, or the outcome of any transaction. To the fullest
        extent permitted by law, Axis is not liable for any loss arising from
        your use of the app.
      </Text>

      <Text style={styles.sectionTitle}>Termination</Text>
      <Text style={styles.paragraph}>
        You may stop using Axis and delete your account at any time. We may
        suspend or terminate accounts that violate these terms or our Community
        Guidelines, or that put other students at risk.
      </Text>

      <Text style={styles.sectionTitle}>Contact us</Text>
      <Text style={styles.paragraph}>
        Questions about these terms? Email us at{' '}
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
          onPress={() => Linking.openURL('https://dataaxis.org/terms')}
          accessibilityRole="link"
        >
          dataaxis.org/terms
        </Text>
        .
      </Text>
    </LegalDocument>
  );
}
